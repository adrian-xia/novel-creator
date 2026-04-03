import { beforeEach, describe, expect, it, vi } from 'vitest';

const listExportableChaptersMock = vi.fn();
const loadApprovedChaptersForExportMock = vi.fn();
const buildExportPreviewMock = vi.fn();
const buildGeneratedExportMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/export-execution-repository', () => ({
  ExportExecutionRepository: class {
    listExportableChapters = listExportableChaptersMock;
    loadApprovedChaptersForExport = loadApprovedChaptersForExportMock;
  }
}));

vi.mock('../../packages/agent-runtime/src/export-execution', () => ({
  buildExportPreview: buildExportPreviewMock,
  buildGeneratedExport: buildGeneratedExportMock
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('phase 4 export execution smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('exposes exportable chapters, preview, and download surfaces', async () => {
    listExportableChaptersMock.mockResolvedValue([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'The trap closes.',
        updatedAt: '2026-04-03T00:00:00.000Z'
      }
    ]);
    loadApprovedChaptersForExportMock.mockResolvedValue([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'The trap closes.',
        content: 'Body'
      }
    ]);
    buildExportPreviewMock.mockReturnValue({
      projectId: 'project-1',
      chapterNumbers: [8],
      format: 'markdown',
      chapterCount: 1,
      content: '# Chapter Eight\n\nBody',
      chapterSummaries: []
    });
    buildGeneratedExportMock.mockResolvedValue({
      fileName: 'project-1-chapters-8.md',
      contentType: 'text/markdown; charset=utf-8',
      content: '# Chapter Eight\n\nBody',
      kind: 'text'
    });

    const app = await buildTestApp();

    const chapters = await app.inject({ method: 'GET', url: '/projects/project-1/exportable-chapters' });
    const preview = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports/preview',
      payload: { chapterNumbers: [8], format: 'markdown' }
    });
    const download = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports',
      payload: { chapterNumbers: [8], format: 'markdown' }
    });

    expect(chapters.statusCode).toBe(200);
    expect(preview.statusCode).toBe(200);
    expect(download.statusCode).toBe(200);

    await app.close();
  });
});
