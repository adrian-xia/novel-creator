import JSZip from 'jszip';
import type { ExportBatchRequest, ExportPreview, GeneratedExport } from '@novel-creator/domain';

interface ExportChapterSource {
  projectId: string;
  chapterNumber: number;
  title: string;
  summary: string;
  content: string;
}

function sortChapterNumbers(chapterNumbers: number[]) {
  return [...chapterNumbers].sort((left, right) => left - right);
}

function assertUniqueChapterNumbers(chapterNumbers: number[]) {
  if (new Set(chapterNumbers).size !== chapterNumbers.length) {
    throw new Error('Duplicate chapter numbers are not allowed');
  }
}

function normalizeRequest(request: ExportBatchRequest): ExportBatchRequest {
  assertUniqueChapterNumbers(request.chapterNumbers);

  return {
    ...request,
    chapterNumbers: sortChapterNumbers(request.chapterNumbers)
  };
}

function countWords(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function buildSelectedChapters(request: ExportBatchRequest, chapters: ExportChapterSource[]) {
  const chaptersByNumber = new Map<number, ExportChapterSource>();

  for (const chapter of chapters) {
    chaptersByNumber.set(chapter.chapterNumber, chapter);
  }

  return request.chapterNumbers.map((chapterNumber) => {
    const chapter = chaptersByNumber.get(chapterNumber);

    if (!chapter) {
      throw new Error(`Missing export source for chapter ${chapterNumber}`);
    }

    if (chapter.projectId !== request.projectId) {
      throw new Error(`Chapter ${chapterNumber} does not belong to project ${request.projectId}`);
    }

    return chapter;
  });
}

function buildPlainTextContent(chapters: ExportChapterSource[]) {
  return chapters
    .map((chapter) => [`Chapter ${chapter.chapterNumber}: ${chapter.title}`, '', chapter.content].join('\n'))
    .join('\n\n---\n\n');
}

function buildMarkdownContent(chapters: ExportChapterSource[]) {
  return chapters.map((chapter) => [`# ${chapter.title}`, '', chapter.content].join('\n')).join('\n\n');
}

function buildChapterSummaries(chapters: ExportChapterSource[]) {
  return chapters.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    summary: chapter.summary,
    wordCount: countWords(chapter.content)
  }));
}

function buildBundleManifest(input: {
  request: ExportBatchRequest;
  chapterSummaries: ReturnType<typeof buildChapterSummaries>;
  exportedAt: string;
}) {
  return {
    projectId: input.request.projectId,
    exportedAt: input.exportedAt,
    format: input.request.format,
    chapterNumbers: input.request.chapterNumbers,
    chapterCount: input.request.chapterNumbers.length,
    totalWordCount: input.chapterSummaries.reduce((sum, chapter) => sum + chapter.wordCount, 0)
  };
}

export function normalizeExportBatchRequest(request: ExportBatchRequest): ExportBatchRequest {
  return normalizeRequest(request);
}

export function buildExportPreview(input: {
  request: ExportBatchRequest;
  chapters: ExportChapterSource[];
  exportedAt: string;
}): ExportPreview {
  const request = normalizeRequest(input.request);
  const selectedChapters = buildSelectedChapters(request, input.chapters);
  const chapterSummaries = buildChapterSummaries(selectedChapters);

  if (request.format === 'bundle') {
    return {
      projectId: request.projectId,
      chapterNumbers: request.chapterNumbers,
      format: 'bundle',
      chapterCount: request.chapterNumbers.length,
      files: ['chapter-summaries.json', 'manifest.json', 'manuscript.md'],
      manifest: buildBundleManifest({ request, chapterSummaries, exportedAt: input.exportedAt }),
      chapterSummaries
    };
  }

  return {
    projectId: request.projectId,
    chapterNumbers: request.chapterNumbers,
    format: request.format,
    chapterCount: request.chapterNumbers.length,
    content:
      request.format === 'plain_text'
        ? buildPlainTextContent(selectedChapters)
        : buildMarkdownContent(selectedChapters),
    chapterSummaries
  };
}

export async function buildGeneratedExport(input: {
  request: ExportBatchRequest;
  chapters: ExportChapterSource[];
  exportedAt: string;
}): Promise<GeneratedExport> {
  const request = normalizeRequest(input.request);
  const selectedChapters = buildSelectedChapters(request, input.chapters);
  const chapterSummaries = buildChapterSummaries(selectedChapters);

  if (request.format === 'plain_text') {
    return {
      fileName: `${request.projectId}-chapters-${request.chapterNumbers.join('-')}.txt`,
      contentType: 'text/plain; charset=utf-8',
      content: buildPlainTextContent(selectedChapters),
      kind: 'text'
    };
  }

  if (request.format === 'markdown') {
    return {
      fileName: `${request.projectId}-chapters-${request.chapterNumbers.join('-')}.md`,
      contentType: 'text/markdown; charset=utf-8',
      content: buildMarkdownContent(selectedChapters),
      kind: 'text'
    };
  }

  const zip = new JSZip();
  const manifest = buildBundleManifest({ request, chapterSummaries, exportedAt: input.exportedAt });

  zip.file('manuscript.md', buildMarkdownContent(selectedChapters));
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('chapter-summaries.json', JSON.stringify(chapterSummaries, null, 2));

  return {
    fileName: `${request.projectId}-chapters-${request.chapterNumbers.join('-')}.zip`,
    contentType: 'application/zip',
    content: await zip.generateAsync({ type: 'uint8array' }),
    kind: 'binary'
  };
}
