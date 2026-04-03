import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chapterReplanFlow, decisionSessionFlow } from '../../packages/workflows/src';

const getDecisionQueueMock = vi.fn();
const appendMessageMock = vi.fn();
const saveDraftResolutionMock = vi.fn();
const saveResolutionMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/project-repository', () => ({
  ProjectRepository: class {
    getDecisionQueue = getDecisionQueueMock;
  }
}));

vi.mock('../../packages/storage/src/repositories/decision-session-repository', () => ({
  DecisionSessionRepository: class {
    appendMessage = appendMessageMock;
    saveDraftResolution = saveDraftResolutionMock;
    saveResolution = saveResolutionMock;
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
    appendMessageMock.mockResolvedValue({
      sessionId: 'session-1',
      sequence: 2,
      role: 'human',
      messageType: 'human',
      content: 'Keep the reveal later.',
      createdAt: new Date('2026-04-02T00:01:00.000Z')
    });
    saveDraftResolutionMock.mockResolvedValue({
      id: 'session-1',
      status: 'awaiting_resolution_confirmation'
    });
    saveResolutionMock.mockResolvedValue({
      id: 'session-1',
      status: 'resolved'
    });

    const app = await buildTestApp();

    const decisionQueue = await app.inject({ method: 'GET', url: '/decision-sessions' });
    const decisionMessage = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-1/messages',
      payload: {
        content: 'Keep the reveal later.'
      }
    });
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
    const resolution = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-1/resolve',
      payload: {
        resolutionType: 'accept_alternative',
        decisionSummary: 'Delay the reveal.',
        storyFactsToApply: ['The reveal remains delayed.'],
        chapterPlanAdjustments: ['Preserve the continuity fix.'],
        volumeImpact: null,
        nextAction: 'resume_current_chapter',
        replanRange: null,
        resumeFromChapter: null,
        invalidateExistingPlans: false
      }
    });

    expect(decisionSessionFlow().name).toBe('decision-session-flow');
    expect(chapterReplanFlow().name).toBe('chapter-replan-flow');
    expect(decisionQueue.statusCode).toBe(200);
    expect(decisionMessage.statusCode).toBe(201);
    expect(resolutionDraft.statusCode).toBe(200);
    expect(resolution.statusCode).toBe(200);

    await app.close();
  });
});
