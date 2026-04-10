import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decisionSessionFlow, publishChapterFlow } from '../../packages/workflows/src';

const getDecisionQueueMock = vi.fn();
const confirmHumanGateMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/project-repository', () => ({
  ProjectRepository: class {
    getDecisionQueue = getDecisionQueueMock;
  }
}));

vi.mock('../../packages/storage/src/repositories/decision-session-repository', () => ({
  DecisionSessionRepository: class {
    confirmHumanGate = confirmHumanGateMock;
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

  it('exposes gate confirmation handoff metadata for the next production workflow', async () => {
    confirmHumanGateMock.mockResolvedValueOnce({
      id: 'session-outline-1',
      gateType: 'outline_confirmation',
      projectId: 'project-1',
      chapterNumber: null,
      status: 'resolved',
      selectedOptionId: 'accept-outline',
      humanNotes: null
    });
    confirmHumanGateMock.mockResolvedValueOnce({
      id: 'session-volume-1',
      gateType: 'volume_confirmation',
      projectId: 'project-1',
      chapterNumber: null,
      status: 'resolved',
      selectedOptionId: 'accept-volume-plans',
      humanNotes: null
    });

    const app = await buildTestApp();

    const outlineConfirm = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-outline-1/confirm',
      payload: {
        selectedOptionId: 'accept-outline',
        humanNotes: null
      }
    });
    const volumeConfirm = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-volume-1/confirm',
      payload: {
        selectedOptionId: 'accept-volume-plans',
        humanNotes: null
      }
    });

    expect(outlineConfirm.statusCode).toBe(200);
    expect(outlineConfirm.json()).toMatchObject({
      sessionId: 'session-outline-1',
      nextWork: {
        flowName: 'generate-volume-flow',
        status: 'queued',
        autoEnqueued: false
      }
    });
    expect(volumeConfirm.statusCode).toBe(200);
    expect(volumeConfirm.json()).toMatchObject({
      sessionId: 'session-volume-1',
      nextWork: {
        flowName: 'generate-chapter-flow',
        status: 'queued',
        autoEnqueued: false
      }
    });

    await app.close();
  });
});
