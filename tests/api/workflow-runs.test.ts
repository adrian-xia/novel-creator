import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  workflowRunRecord: {
    findMany: vi.fn(),
    findUnique: vi.fn()
  }
}));

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('workflow run routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('lists workflow runs through repository listRuns', async () => {
    prisma.workflowRunRecord.findMany.mockResolvedValue([
      {
        id: 'workflow-run-1',
        flowName: 'publish-chapter-flow',
        projectId: 'project-1',
        chapterNumber: 8,
        status: 'running',
        errorMessage: null,
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
        updatedAt: new Date('2026-04-03T00:01:00.000Z')
      }
    ]);

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/workflow-runs'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          runId: 'workflow-run-1',
          flowName: 'publish-chapter-flow',
          projectId: 'project-1',
          chapterNumber: 8,
          status: 'running',
          errorMessage: null,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:01:00.000Z'
        }
      ]
    });
    expect(prisma.workflowRunRecord.findMany).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('returns workflow run detail with steps from the repository', async () => {
    prisma.workflowRunRecord.findUnique.mockResolvedValue({
      id: 'workflow-run-1',
      flowName: 'publish-chapter-flow',
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'succeeded',
      errorMessage: null,
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      updatedAt: new Date('2026-04-03T00:01:00.000Z'),
      stepRuns: [
        {
          workflowRunId: 'workflow-run-1',
          stepName: 'expand-publish-tasks',
          status: 'succeeded',
          errorMessage: null,
          startedAt: new Date('2026-04-03T00:00:00.000Z'),
          updatedAt: new Date('2026-04-03T00:01:00.000Z')
        }
      ]
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/workflow-runs/workflow-run-1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      runId: 'workflow-run-1',
      flowName: 'publish-chapter-flow',
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'succeeded',
      errorMessage: null,
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:01:00.000Z',
      steps: [
        {
          workflowRunId: 'workflow-run-1',
          stepName: 'expand-publish-tasks',
          status: 'succeeded',
          errorMessage: null,
          startedAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:01:00.000Z'
        }
      ]
    });

    await app.close();
  });

  it('returns 404 when a workflow run does not exist', async () => {
    prisma.workflowRunRecord.findUnique.mockResolvedValue(null);

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/workflow-runs/workflow-run-missing'
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      message: 'Workflow run not found'
    });

    await app.close();
  });
});
