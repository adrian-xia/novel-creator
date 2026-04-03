import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  chapterStateRecord: {
    findMany: vi.fn()
  },
  chapterDraftRecord: {
    findMany: vi.fn()
  },
  chapterPlanRecord: {
    findMany: vi.fn()
  }
}));

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('ExportExecutionRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    Object.values(prisma).forEach((model) => {
      if (typeof model === 'function') {
        return;
      }

      Object.values(model).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          fn.mockReset();
        }
      });
    });
  });

  it('lists only approved chapters as exportable choices with deterministic plan lookups', async () => {
    prisma.chapterStateRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 9, status: 'approved', updatedAt: new Date('2026-04-03T01:00:00.000Z') },
      { projectId: 'project-1', chapterNumber: 8, status: 'approved', updatedAt: new Date('2026-04-03T00:00:00.000Z') }
    ]);
    prisma.chapterDraftRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, version: 2, content: 'Chapter 8 text', summary: 'Chapter 8 summary', metadata: {} },
      { projectId: 'project-1', chapterNumber: 8, version: 1, content: 'Older chapter 8 text', summary: 'Older summary', metadata: {} },
      { projectId: 'project-1', chapterNumber: 9, version: 1, content: 'Chapter 9 text', summary: 'Chapter 9 summary', metadata: {} }
    ]);
    prisma.chapterPlanRecord.findMany.mockResolvedValue([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        invalidatedAt: null,
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
        payload: { title: 'Chapter Eight' }
      },
      {
        projectId: 'project-1',
        chapterNumber: 9,
        invalidatedAt: null,
        createdAt: new Date('2026-04-02T01:00:00.000Z'),
        payload: { title: 'Chapter Nine' }
      }
    ]);

    const { ExportExecutionRepository } = await import(
      '../../packages/storage/src/repositories/export-execution-repository'
    );
    const repository = new ExportExecutionRepository();

    await expect(repository.listExportableChapters('project-1')).resolves.toEqual([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'Chapter 8 summary',
        updatedAt: '2026-04-03T00:00:00.000Z'
      },
      {
        projectId: 'project-1',
        chapterNumber: 9,
        title: 'Chapter Nine',
        summary: 'Chapter 9 summary',
        updatedAt: '2026-04-03T01:00:00.000Z'
      }
    ]);

    expect(prisma.chapterStateRecord.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', status: 'approved' },
      orderBy: { chapterNumber: 'asc' }
    });
    expect(prisma.chapterDraftRecord.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', chapterNumber: { in: [8, 9] } },
      orderBy: [{ chapterNumber: 'asc' }, { version: 'desc' }]
    });
    expect(prisma.chapterPlanRecord.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', chapterNumber: { in: [8, 9] }, invalidatedAt: null },
      orderBy: [{ chapterNumber: 'asc' }, { createdAt: 'desc' }]
    });
  });

  it('loads the latest approved chapter drafts for a batch export', async () => {
    prisma.chapterStateRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, status: 'approved' },
      { projectId: 'project-1', chapterNumber: 9, status: 'approved' }
    ]);
    prisma.chapterDraftRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, version: 1, content: 'old 8', summary: 'old summary', metadata: {} },
      { projectId: 'project-1', chapterNumber: 8, version: 2, content: 'new 8', summary: 'new summary', metadata: {} },
      { projectId: 'project-1', chapterNumber: 9, version: 1, content: 'new 9', summary: 'chapter 9 summary', metadata: {} }
    ]);
    prisma.chapterPlanRecord.findMany.mockResolvedValue([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        invalidatedAt: null,
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
        payload: { title: 'Chapter Eight' }
      },
      {
        projectId: 'project-1',
        chapterNumber: 9,
        invalidatedAt: null,
        createdAt: new Date('2026-04-02T01:00:00.000Z'),
        payload: { title: 'Chapter Nine' }
      }
    ]);

    const { ExportExecutionRepository } = await import(
      '../../packages/storage/src/repositories/export-execution-repository'
    );
    const repository = new ExportExecutionRepository();

    await expect(
      repository.loadApprovedChaptersForExport({
        projectId: 'project-1',
        chapterNumbers: [9, 8]
      })
    ).resolves.toEqual([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'new summary',
        content: 'new 8'
      },
      {
        projectId: 'project-1',
        chapterNumber: 9,
        title: 'Chapter Nine',
        summary: 'chapter 9 summary',
        content: 'new 9'
      }
    ]);
  });

  it('rejects approved chapters that are missing export content', async () => {
    prisma.chapterStateRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, status: 'approved' }
    ]);
    prisma.chapterDraftRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, version: 2, content: '', summary: 'Chapter 8 summary', metadata: {} }
    ]);
    prisma.chapterPlanRecord.findMany.mockResolvedValue([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        invalidatedAt: null,
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
        payload: { title: 'Chapter Eight' }
      }
    ]);

    const { ExportExecutionRepository } = await import(
      '../../packages/storage/src/repositories/export-execution-repository'
    );
    const repository = new ExportExecutionRepository();

    await expect(
      repository.loadApprovedChaptersForExport({
        projectId: 'project-1',
        chapterNumbers: [8]
      })
    ).rejects.toThrow('Approved chapter 8 is missing export content');
  });

  it('rejects non-approved batch chapters with concrete chapter numbers', async () => {
    prisma.chapterStateRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, status: 'approved' }
    ]);

    const { ExportExecutionRepository } = await import(
      '../../packages/storage/src/repositories/export-execution-repository'
    );
    const repository = new ExportExecutionRepository();

    await expect(
      repository.loadApprovedChaptersForExport({
        projectId: 'project-1',
        chapterNumbers: [9, 7, 8]
      })
    ).rejects.toThrow('Export batch contains non-approved chapters: 7, 9');
  });
});
