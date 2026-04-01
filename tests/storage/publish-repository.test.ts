import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  publishProfileRecord: {
    upsert: vi.fn(),
    findUnique: vi.fn()
  },
  publishTaskRecord: {
    create: vi.fn()
  },
  exportArtifactRecord: {
    create: vi.fn()
  }
}));

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('PublishRepository', () => {
  beforeEach(() => {
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma)
    );

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

  it('stores a project publish profile and expands mixed publish tasks', async () => {
    prisma.publishProfileRecord.upsert.mockResolvedValue({
      projectId: 'project-1',
      publishEnabled: true,
      autoPublishTargets: ['alpha'],
      manualExportTargets: ['beta'],
      defaultExportFormat: 'bundle',
      effectiveFromChapter: 3
    });
    prisma.publishProfileRecord.findUnique.mockResolvedValue({
      projectId: 'project-1',
      publishEnabled: true,
      autoPublishTargets: ['alpha'],
      manualExportTargets: ['beta'],
      defaultExportFormat: 'bundle',
      effectiveFromChapter: 3
    });
    prisma.publishTaskRecord.create.mockImplementation(async ({ data }) => data);

    const { PublishRepository } = await import(
      '../../packages/storage/src/repositories/publish-repository'
    );
    const repository = new PublishRepository();

    await repository.upsertPublishProfile({
      projectId: 'project-1',
      publishEnabled: true,
      autoPublishTargets: ['alpha'],
      manualExportTargets: ['beta'],
      defaultExportFormat: 'bundle',
      effectiveFromChapter: 3
    });

    const tasks = await repository.createPublishTasks({
      projectId: 'project-1',
      chapterNumber: 3,
      payloadSnapshot: { title: 'Chapter 3' }
    });

    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.mode).sort()).toEqual(['adapter_publish', 'manual_export']);
  });
});
