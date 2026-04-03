import JSZip from '../../packages/agent-runtime/node_modules/jszip';
import { describe, expect, it } from 'vitest';
import {
  buildExportPreview,
  buildGeneratedExport,
  normalizeExportBatchRequest
} from '../../packages/agent-runtime/src/export-execution';

describe('export execution helpers', () => {
  const chapters = [
    {
      projectId: 'project-1',
      chapterNumber: 8,
      title: 'Chapter Eight',
      summary: 'The trap closes.',
      content: 'Chapter 8 content.'
    },
    {
      projectId: 'project-1',
      chapterNumber: 9,
      title: 'Chapter Nine',
      summary: 'The escape begins.',
      content: 'Chapter 9 content.'
    }
  ];

  it('normalizes chapter selections before preview and export', () => {
    expect(
      normalizeExportBatchRequest({
        projectId: 'project-1',
        chapterNumbers: [9, 8],
        format: 'markdown'
      })
    ).toEqual({
      projectId: 'project-1',
      chapterNumbers: [8, 9],
      format: 'markdown'
    });
  });

  it('builds preview content for plain text exports', () => {
    const preview = buildExportPreview({
      request: {
        projectId: 'project-1',
        chapterNumbers: [8, 9],
        format: 'plain_text'
      },
      chapters,
      exportedAt: '2026-04-03T00:00:00.000Z'
    });

    expect(preview.format).toBe('plain_text');
    expect(preview.content).toContain('Chapter 8: Chapter Eight');
    expect(preview.content).toContain('---');
    expect(preview.chapterSummaries).toEqual([
      {
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'The trap closes.',
        wordCount: 3
      },
      {
        chapterNumber: 9,
        title: 'Chapter Nine',
        summary: 'The escape begins.',
        wordCount: 3
      }
    ]);
  });

  it('builds a bundle zip with a manifest that matches preview data', async () => {
    const preview = buildExportPreview({
      request: {
        projectId: 'project-1',
        chapterNumbers: [8, 9],
        format: 'bundle'
      },
      chapters,
      exportedAt: '2026-04-03T00:00:00.000Z'
    });

    const generated = await buildGeneratedExport({
      request: {
        projectId: 'project-1',
        chapterNumbers: [8, 9],
        format: 'bundle'
      },
      chapters,
      exportedAt: '2026-04-03T00:00:00.000Z'
    });

    expect(preview.format).toBe('bundle');
    expect(preview.files).toEqual(['chapter-summaries.json', 'manifest.json', 'manuscript.md']);

    expect(generated.kind).toBe('binary');
    expect(generated.fileName).toBe('project-1-chapters-8-9.zip');
    expect(generated.content).toBeInstanceOf(Uint8Array);

    const zip = await JSZip.loadAsync(generated.content as Uint8Array);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(preview.manifest).toEqual(manifest);
  });

  it('rejects duplicate chapter numbers instead of silently deduplicating them', () => {
    expect(() =>
      normalizeExportBatchRequest({
        projectId: 'project-1',
        chapterNumbers: [8, 8],
        format: 'markdown'
      })
    ).toThrow('Duplicate chapter numbers are not allowed');
  });
});
