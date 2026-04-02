import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decisionSessionFlow, publishChapterFlow } from '../../packages/workflows/src';

const getDecisionQueueMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/project-repository', () => ({
  ProjectRepository: class {
    getDecisionQueue = getDecisionQueueMock;
  }
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('phase 3 smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('exposes the decision, publishing, and workflow observability surfaces', async () => {
    getDecisionQueueMock.mockResolvedValue([
      {
        id: 'session-1',
        projectId: 'project-1',
        chapterNumber: 8,
        status: 'awaiting_human_input',
        triggerReason: 'critical_reversal',
        updatedAt: new Date('2026-04-02T00:00:00.000Z')
      }
    ]);

    const app = await buildTestApp();

    const decisionQueue = await app.inject({ method: 'GET', url: '/decision-sessions' });
    const publishTasks = await app.inject({ method: 'GET', url: '/publish-tasks' });
    const workflowRuns = await app.inject({ method: 'GET', url: '/workflow-runs' });

    expect(decisionSessionFlow().name).toBe('decision-session-flow');
    expect(publishChapterFlow().name).toBe('publish-chapter-flow');
    expect(decisionQueue.statusCode).toBe(200);
    expect(publishTasks.statusCode).toBe(200);
    expect(workflowRuns.statusCode).toBe(200);

    await app.close();
  });
});
