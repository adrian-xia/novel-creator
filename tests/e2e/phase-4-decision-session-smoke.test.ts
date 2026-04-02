import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chapterReplanFlow, decisionSessionFlow } from '../../packages/workflows/src';

const getDecisionQueueMock = vi.fn();
const saveDraftResolutionMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/project-repository', () => ({
  ProjectRepository: class {
    getDecisionQueue = getDecisionQueueMock;
  }
}));

vi.mock('../../packages/storage/src/repositories/decision-session-repository', () => ({
  DecisionSessionRepository: class {
    saveDraftResolution = saveDraftResolutionMock;
  }
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('phase 4 decision-session smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('exposes real decision-session and recovery surfaces', async () => {
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
    saveDraftResolutionMock.mockResolvedValue({
      id: 'session-1',
      status: 'awaiting_resolution_confirmation'
    });

    const app = await buildTestApp();

    const decisionQueue = await app.inject({ method: 'GET', url: '/decision-sessions' });
    const resolutionDraft = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-1/generate-resolution',
      payload: {
        resolutionType: 'replan_required',
        decisionSummary: '延后一章揭示',
        storyFactsToApply: [],
        chapterPlanAdjustments: [],
        volumeImpact: null,
        replanRange: { startChapter: 8, endChapter: 10 }
      }
    });

    expect(decisionSessionFlow().name).toBe('decision-session-flow');
    expect(chapterReplanFlow().name).toBe('chapter-replan-flow');
    expect(decisionQueue.statusCode).toBe(200);
    expect(resolutionDraft.statusCode).toBe(200);

    await app.close();
  });
});
