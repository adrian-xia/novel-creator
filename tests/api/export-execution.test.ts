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

describe('export execution routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('lists exportable approved chapters', async () => {
    listExportableChaptersMock.mockResolvedValue([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'The trap closes.',
        updatedAt: '2026-04-03T00:00:00.000Z'
      }
    ]);

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/projects/project-1/exportable-chapters'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          projectId: 'project-1',
          chapterNumber: 8,
          title: 'Chapter Eight',
          summary: 'The trap closes.',
          updatedAt: '2026-04-03T00:00:00.000Z'
        }
      ]
    });

    await app.close();
  });

  it('returns a preview payload for a valid export batch', async () => {
    loadApprovedChaptersForExportMock.mockResolvedValue([
      {
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

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports/preview',
      payload: {
        chapterNumbers: [8],
        format: 'markdown'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      projectId: 'project-1',
      format: 'markdown'
    });

    await app.close();
  });

  it('rejects duplicate chapter numbers with a concrete validation error', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports/preview',
      payload: {
        chapterNumbers: [8, 8],
        format: 'markdown'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Duplicate chapter numbers are not allowed'
    });

    await app.close();
  });

  it('streams a generated export file for a valid batch', async () => {
    loadApprovedChaptersForExportMock.mockResolvedValue([
      {
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'The trap closes.',
        content: 'Body'
      }
    ]);
    buildGeneratedExportMock.mockResolvedValue({
      fileName: 'project-1-chapters-8.md',
      contentType: 'text/markdown; charset=utf-8',
      content: '# Chapter Eight\n\nBody',
      kind: 'text'
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports',
      payload: {
        chapterNumbers: [8],
        format: 'markdown'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/markdown');
    expect(response.headers['content-disposition']).toContain('project-1-chapters-8.md');

    await app.close();
  });

  it('returns zip headers for bundle exports', async () => {
    loadApprovedChaptersForExportMock.mockResolvedValue([
      {
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'The trap closes.',
        content: 'Body'
      }
    ]);
    buildGeneratedExportMock.mockResolvedValue({
      fileName: 'project-1-chapters-8.zip',
      contentType: 'application/zip',
      content: new Uint8Array([1, 2, 3]),
      kind: 'binary'
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports',
      payload: {
        chapterNumbers: [8],
        format: 'bundle'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/zip');
    expect(response.headers['content-disposition']).toContain('project-1-chapters-8.zip');

    await app.close();
  });
});
