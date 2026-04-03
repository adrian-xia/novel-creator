import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  publishProfileRecord: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  publishTaskRecord: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  exportArtifactRecord: {
    findMany: vi.fn()
  }
}));

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('publishing routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns the stored publish profile for a project', async () => {
    prisma.publishProfileRecord.findUnique.mockResolvedValue({
      projectId: 'project-1',
      publishEnabled: true,
      autoPublishTargets: ['alpha'],
      manualExportTargets: ['beta'],
      defaultExportFormat: 'bundle',
      effectiveFromChapter: 3
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/projects/project-1/publish-profile'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projectId: 'project-1',
      publishEnabled: true,
      autoPublishTargets: ['alpha'],
      manualExportTargets: ['beta'],
      defaultExportFormat: 'bundle',
      effectiveFromChapter: 3
    });
    expect(prisma.publishProfileRecord.findUnique).toHaveBeenCalledWith({
      where: { projectId: 'project-1' }
    });

    await app.close();
  });

  it('preserves publish profile updates through the repository-backed PUT route', async () => {
    prisma.publishProfileRecord.upsert.mockResolvedValue({
      projectId: 'project-1',
      publishEnabled: true,
      autoPublishTargets: ['alpha'],
      manualExportTargets: ['beta'],
      defaultExportFormat: 'markdown',
      effectiveFromChapter: 2
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/projects/project-1/publish-profile',
      payload: {
        publishEnabled: true,
        autoPublishTargets: ['alpha'],
        manualExportTargets: ['beta'],
        defaultExportFormat: 'markdown',
        effectiveFromChapter: 2
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projectId: 'project-1',
      publishEnabled: true,
      autoPublishTargets: ['alpha'],
      manualExportTargets: ['beta'],
      defaultExportFormat: 'markdown',
      effectiveFromChapter: 2
    });
    expect(prisma.publishProfileRecord.upsert).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('lists publish tasks and artifacts through repository read methods', async () => {
    prisma.publishTaskRecord.findMany.mockResolvedValue([
      {
        id: 'task-1',
        projectId: 'project-1',
        chapterNumber: 8,
        targetPlatform: 'alpha',
        mode: 'adapter_publish',
        status: 'published',
        payloadSnapshot: { title: 'Chapter Eight' },
        artifactId: 'artifact-1',
        attemptCount: 1,
        lastError: null,
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
        updatedAt: new Date('2026-04-03T00:01:00.000Z')
      }
    ]);
    prisma.exportArtifactRecord.findMany.mockResolvedValue([
      {
        id: 'artifact-1',
        projectId: 'project-1',
        chapterNumber: 8,
        targetPlatform: 'alpha',
        format: 'markdown',
        content: '# Chapter Eight',
        createdAt: new Date('2026-04-03T00:00:00.000Z')
      }
    ]);

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/publish-tasks'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          id: 'task-1',
          projectId: 'project-1',
          chapterNumber: 8,
          targetPlatform: 'alpha',
          mode: 'adapter_publish',
          status: 'published',
          payloadSnapshot: { title: 'Chapter Eight' },
          artifactId: 'artifact-1',
          attemptCount: 1,
          lastError: null,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:01:00.000Z'
        }
      ],
      artifacts: [
        {
          id: 'artifact-1',
          projectId: 'project-1',
          chapterNumber: 8,
          targetPlatform: 'alpha',
          format: 'markdown',
          content: '# Chapter Eight',
          createdAt: '2026-04-03T00:00:00.000Z'
        }
      ]
    });
    expect(prisma.publishTaskRecord.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.exportArtifactRecord.findMany).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('returns 400 when manual upload confirmation targets a missing task', async () => {
    prisma.publishTaskRecord.findUnique.mockResolvedValue(null);

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/publish-tasks/task-404/manual-upload-confirm'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Invalid manual upload confirmation'
    });

    await app.close();
  });

  it('returns 400 when manual upload confirmation hits an illegal task state', async () => {
    prisma.publishTaskRecord.findUnique.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
      chapterNumber: 8,
      targetPlatform: 'beta',
      mode: 'manual_export',
      status: 'published',
      payloadSnapshot: { title: 'Chapter Eight' },
      artifactId: 'artifact-1',
      attemptCount: 1,
      lastError: null
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/publish-tasks/task-1/manual-upload-confirm'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Invalid manual upload confirmation'
    });

    await app.close();
  });

  it('confirms manual upload through the repository-backed route', async () => {
    prisma.publishTaskRecord.findUnique.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
      chapterNumber: 8,
      targetPlatform: 'beta',
      mode: 'manual_export',
      status: 'manual_upload_pending',
      payloadSnapshot: { title: 'Chapter Eight' },
      artifactId: 'artifact-1',
      attemptCount: 1,
      lastError: null
    });
    prisma.publishTaskRecord.update.mockResolvedValue({
      id: 'task-1',
      status: 'manual_upload_confirmed'
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/publish-tasks/task-1/manual-upload-confirm'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      taskId: 'task-1',
      status: 'manual_upload_confirmed'
    });
    expect(prisma.publishTaskRecord.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        status: 'manual_upload_confirmed',
        artifactId: 'artifact-1',
        lastError: null
      }
    });

    await app.close();
  });
});
