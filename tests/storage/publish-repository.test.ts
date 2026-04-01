import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  publishProfileRecord: {
    upsert: vi.fn(),
    findUnique: vi.fn()
  },
  publishTaskRecord: {
    upsert: vi.fn(),
    findMany: vi.fn()
  },
  exportArtifactRecord: {
    create: vi.fn()
  }
}));

const taskStore = vi.hoisted(() => new Map<string, {
  id: string;
  projectId: string;
  chapterNumber: number;
  targetPlatform: string;
  mode: 'adapter_publish' | 'manual_export';
  status: string;
  payloadSnapshot: Record<string, unknown>;
  artifactId: string | null;
  attemptCount: number;
  lastError: string | null;
}>());

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('PublishRepository', () => {
  beforeEach(() => {
    taskStore.clear();

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

  it('expands mixed publish tasks and preserves advanced task state on retry', async () => {
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
    prisma.publishTaskRecord.upsert.mockImplementation(async ({ where, create, update }) => {
      const key = `${where.projectId_chapterNumber_targetPlatform_mode.projectId}:${where.projectId_chapterNumber_targetPlatform_mode.chapterNumber}:${where.projectId_chapterNumber_targetPlatform_mode.targetPlatform}:${where.projectId_chapterNumber_targetPlatform_mode.mode}`;
      const existing = taskStore.get(key);

      if (existing) {
        const merged = {
          ...existing,
          ...update
        };
        taskStore.set(key, merged);
        return merged;
      }

      const created = {
        id: `task-${taskStore.size + 1}`,
        artifactId: null,
        attemptCount: 0,
        lastError: null,
        ...create
      };
      taskStore.set(key, created);
      return created;
    });
    prisma.publishTaskRecord.findMany.mockImplementation(async ({ where }) =>
      [...taskStore.values()]
        .filter(
          (task) => task.projectId === where.projectId && task.chapterNumber === where.chapterNumber
        )
        .sort((left, right) =>
          `${left.targetPlatform}:${left.mode}`.localeCompare(`${right.targetPlatform}:${right.mode}`)
        )
    );

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
    expect(tasks.map((task) => task.status)).toEqual(['pending', 'pending']);

    taskStore.set('project-1:3:alpha:adapter_publish', {
      ...taskStore.get('project-1:3:alpha:adapter_publish')!,
      status: 'published',
      artifactId: 'artifact-1',
      lastError: null,
      payloadSnapshot: { title: 'Chapter 3', revision: 1 }
    });
    taskStore.set('project-1:3:beta:manual_export', {
      ...taskStore.get('project-1:3:beta:manual_export')!,
      status: 'manual_upload_pending',
      artifactId: null,
      lastError: 'waiting for upload confirmation',
      payloadSnapshot: { title: 'Chapter 3', revision: 1 }
    });

    const retriedTasks = await repository.createPublishTasks({
      projectId: 'project-1',
      chapterNumber: 3,
      payloadSnapshot: { title: 'Chapter 3', revision: 2 }
    });

    expect(retriedTasks).toHaveLength(2);
    expect(retriedTasks.map((task) => task.status).sort()).toEqual([
      'manual_upload_pending',
      'published'
    ]);
    expect(retriedTasks.find((task) => task.targetPlatform === 'alpha')?.artifactId).toBe(
      'artifact-1'
    );
    expect(retriedTasks.find((task) => task.targetPlatform === 'beta')?.lastError).toBe(
      'waiting for upload confirmation'
    );
    expect(prisma.publishTaskRecord.upsert).toHaveBeenCalledTimes(4);
    expect(prisma.publishTaskRecord.upsert.mock.calls.map((call) => call[0].update)).toEqual([
      {},
      {},
      {},
      {}
    ]);
  });

  it('rejects overlapping publish targets at the repository boundary', async () => {
    const { PublishRepository } = await import(
      '../../packages/storage/src/repositories/publish-repository'
    );
    const repository = new PublishRepository();

    await expect(
      repository.upsertPublishProfile({
        projectId: 'project-1',
        publishEnabled: true,
        autoPublishTargets: ['alpha'],
        manualExportTargets: ['alpha'],
        defaultExportFormat: 'bundle',
        effectiveFromChapter: null
      })
    ).rejects.toThrow(/overlap/i);

    expect(prisma.publishProfileRecord.upsert).not.toHaveBeenCalled();
  });
});
