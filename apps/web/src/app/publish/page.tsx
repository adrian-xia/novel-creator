import React from 'react';
import {
  getExportableChapters,
  getPublishCenter,
  previewExportBatch
} from '../../lib/api';

function toNumberArray(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

export default async function PublishCenterPage({
  searchParams
}: {
  searchParams?: Promise<{
    projectId?: string;
    chapterNumbers?: string | string[];
    format?: 'plain_text' | 'markdown' | 'bundle';
    preview?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const projectId = params.projectId ?? null;
  const chapterNumbers = toNumberArray(params.chapterNumbers);
  const format = params.format ?? 'markdown';
  const detail = await getPublishCenter();
  const exportable = projectId
    ? await getExportableChapters(projectId)
    : { items: [] };
  const preview =
    projectId && params.preview === '1' && chapterNumbers.length > 0
      ? await previewExportBatch({ projectId, chapterNumbers, format })
      : null;

  return (
    <main>
      <h1>Publish Center</h1>
      <section>
        <h2>Export Batch</h2>
        {projectId ? (
          <form action="/publish" method="GET">
            <input type="hidden" name="projectId" value={projectId} />
            <select name="format" defaultValue={format}>
              <option value="plain_text">plain_text</option>
              <option value="markdown">markdown</option>
              <option value="bundle">bundle</option>
            </select>
            {exportable.items.map((item) => (
              <label key={item.chapterNumber}>
                <input
                  type="checkbox"
                  name="chapterNumbers"
                  value={item.chapterNumber}
                  defaultChecked={chapterNumbers.includes(item.chapterNumber)}
                />
                {item.title}
              </label>
            ))}
            <button type="submit" name="preview" value="1">
              Preview
            </button>
          </form>
        ) : (
          <p>Select a project from its detail page to export approved chapters.</p>
        )}
      </section>
      {preview ? (
        <section>
          <h2>Preview</h2>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
          <form action="/publish/export" method="POST">
            <input type="hidden" name="projectId" value={projectId ?? ''} />
            <input type="hidden" name="format" value={format} />
            {chapterNumbers.map((chapterNumber) => (
              <input
                key={chapterNumber}
                type="hidden"
                name="chapterNumber"
                value={chapterNumber}
              />
            ))}
            <button type="submit">Export</button>
          </form>
        </section>
      ) : null}
      <section>
        <h2>Tasks</h2>
        <pre>{JSON.stringify(detail.tasks, null, 2)}</pre>
      </section>
      <section>
        <h2>Artifacts</h2>
        <pre>{JSON.stringify(detail.artifacts, null, 2)}</pre>
      </section>
    </main>
  );
}
