import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveDraftResolutionMock = vi.fn();
const saveResolutionMock = vi.fn();
const createRecoveryTaskMock = vi.fn();
const createRunMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/decision-session-repository', () => ({
  DecisionSessionRepository: class {
    saveDraftResolution = saveDraftResolutionMock;
    saveResolution = saveResolutionMock;
  }
}));

vi.mock('../../packages/storage/src/repositories/decision-recovery-repository', () => ({
  DecisionRecoveryRepository: class {
    createRecoveryTask = createRecoveryTaskMock;
  }
}));

vi.mock('../../packages/storage/src/repositories/workflow-run-repository', () => ({
  WorkflowRunRepository: class {
    createRun = createRunMock;
  }
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('decision session resolution routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('generates a structured resolution draft for confirmation', async () => {
    saveDraftResolutionMock.mockResolvedValue({
      id: 'session-123',
      status: 'awaiting_resolution_confirmation'
    });

    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/generate-resolution',
      payload: {
        resolutionType: 'replan_required',
        decisionSummary: 'Delay the reveal and rebuild chapters 8 through 10.',
        storyFactsToApply: ['The villain identity remains hidden.'],
        chapterPlanAdjustments: ['Move the reveal beat from chapter 8 to chapter 10.'],
        volumeImpact: 'The midpoint shifts later.',
        replanRange: {
          startChapter: 8,
          endChapter: 10
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessionId: 'session-123',
      status: 'awaiting_resolution_confirmation',
      resolution: {
        sessionId: 'session-123',
        resolutionType: 'replan_required',
        decisionSummary: 'Delay the reveal and rebuild chapters 8 through 10.',
        storyFactsToApply: ['The villain identity remains hidden.'],
        chapterPlanAdjustments: ['Move the reveal beat from chapter 8 to chapter 10.'],
        volumeImpact: 'The midpoint shifts later.',
        nextAction: 'replan_window',
        replanRange: {
          startChapter: 8,
          endChapter: 10
        },
        resumeFromChapter: 8,
        invalidateExistingPlans: true
      },
      confirmation: {
        required: true,
        requestType: 'confirm_resolution'
      }
    });
    expect(saveDraftResolutionMock).toHaveBeenCalledWith('session-123', {
      sessionId: 'session-123',
      resolutionType: 'replan_required',
      decisionSummary: 'Delay the reveal and rebuild chapters 8 through 10.',
      storyFactsToApply: ['The villain identity remains hidden.'],
      chapterPlanAdjustments: ['Move the reveal beat from chapter 8 to chapter 10.'],
      volumeImpact: 'The midpoint shifts later.',
      nextAction: 'replan_window',
      replanRange: {
        startChapter: 8,
        endChapter: 10
      },
      resumeFromChapter: 8,
      invalidateExistingPlans: true
    });
    await app.close();
  });

  it('rejects an invalid resolution draft payload', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/generate-resolution',
      payload: {
        resolutionType: 'replan_required',
        decisionSummary: 'Delay the reveal.'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid decision resolution payload'
    });
    await app.close();
  });

  it('rejects pause_project drafts that carry replan metadata', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/generate-resolution',
      payload: {
        resolutionType: 'pause_project',
        decisionSummary: 'Pause until editorial review is complete.',
        storyFactsToApply: [],
        chapterPlanAdjustments: [],
        volumeImpact: null,
        replanRange: {
          startChapter: 8,
          endChapter: 10
        }
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid decision resolution payload'
    });
    await app.close();
  });

  it('accepts a confirmed resolution payload and returns the resolved route shape', async () => {
    saveResolutionMock.mockResolvedValue({
      id: 'session-123',
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'resolved'
    });
    createRunMock.mockResolvedValue({
      id: 'workflow-run-review-1',
      status: 'queued'
    });

    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/resolve',
      payload: {
        resolutionType: 'accept_alternative',
        decisionSummary: 'Use the assistant alternative ending.',
        storyFactsToApply: ['The mentor survives.'],
        chapterPlanAdjustments: ['Replace the final confrontation beat.'],
        volumeImpact: null,
        nextAction: 'resume_current_chapter',
        replanRange: null,
        resumeFromChapter: null,
        invalidateExistingPlans: false
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessionId: 'session-123',
      status: 'resolved',
      resolution: {
        sessionId: 'session-123',
        resolutionType: 'accept_alternative',
        decisionSummary: 'Use the assistant alternative ending.',
        storyFactsToApply: ['The mentor survives.'],
        chapterPlanAdjustments: ['Replace the final confrontation beat.'],
        volumeImpact: null,
        nextAction: 'resume_current_chapter',
        replanRange: null,
        resumeFromChapter: null,
        invalidateExistingPlans: false
      },
      recoveryWork: {
        workflowRunId: 'workflow-run-review-1',
        flowName: 'review-rewrite-flow',
        status: 'queued',
        steps: ['execute-review-rewrite'],
        autoEnqueued: true
      }
    });
    expect(saveResolutionMock).toHaveBeenCalledWith({
      sessionId: 'session-123',
      resolutionType: 'accept_alternative',
      decisionSummary: 'Use the assistant alternative ending.',
      storyFactsToApply: ['The mentor survives.'],
      chapterPlanAdjustments: ['Replace the final confrontation beat.'],
      volumeImpact: null,
      nextAction: 'resume_current_chapter',
      replanRange: null,
      resumeFromChapter: null,
      invalidateExistingPlans: false
    });
    expect(createRunMock).toHaveBeenCalledWith({
      flowName: 'review-rewrite-flow',
      projectId: 'project-1',
      chapterNumber: 8
    });
    await app.close();
  });

  it('rejects an invalid confirmed resolution payload', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/resolve',
      payload: {
        resolutionType: 'pause_project',
        decisionSummary: 'Pause until approvals arrive.',
        storyFactsToApply: [],
        chapterPlanAdjustments: [],
        volumeImpact: null,
        nextAction: 'resume_current_chapter',
        replanRange: null,
        resumeFromChapter: null,
        invalidateExistingPlans: false
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid decision resolution payload'
    });
    await app.close();
  });

  it('accepts a replan resolution when resumeFromChapter is within the replan range', async () => {
    saveResolutionMock.mockResolvedValue({
      id: 'session-123',
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'resolved'
    });
    createRecoveryTaskMock.mockResolvedValue({
      id: 'recovery-task-1',
      projectId: 'project-1',
      sessionId: 'session-123',
      startChapter: 8,
      endChapter: 10,
      resumeFromChapter: 9,
      status: 'pending'
    });
    createRunMock.mockResolvedValue({
      id: 'workflow-run-replan-1',
      status: 'queued'
    });

    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/resolve',
      payload: {
        resolutionType: 'replan_required',
        decisionSummary: 'Rework the window and resume after the revised setup.',
        storyFactsToApply: ['The reveal remains delayed.'],
        chapterPlanAdjustments: ['Rebuild chapters 8 to 10 around the new midpoint.'],
        volumeImpact: null,
        nextAction: 'replan_window',
        replanRange: {
          startChapter: 8,
          endChapter: 10
        },
        resumeFromChapter: 9,
        invalidateExistingPlans: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessionId: 'session-123',
      status: 'resolved',
      resolution: {
        sessionId: 'session-123',
        resolutionType: 'replan_required',
        decisionSummary: 'Rework the window and resume after the revised setup.',
        storyFactsToApply: ['The reveal remains delayed.'],
        chapterPlanAdjustments: ['Rebuild chapters 8 to 10 around the new midpoint.'],
        volumeImpact: null,
        nextAction: 'replan_window',
        replanRange: {
          startChapter: 8,
          endChapter: 10
        },
        resumeFromChapter: 9,
        invalidateExistingPlans: true
      },
      recoveryWork: {
        workflowRunId: 'workflow-run-replan-1',
        flowName: 'chapter-replan-flow',
        status: 'queued',
        steps: [
          'load-recovery-task',
          'invalidate-plans-in-window',
          'set-chapters-needs-replan',
          'enqueue-replan-window',
          'mark-recovery-task-complete'
        ],
        autoEnqueued: true
      }
    });
    expect(saveResolutionMock).toHaveBeenCalledWith({
      sessionId: 'session-123',
      resolutionType: 'replan_required',
      decisionSummary: 'Rework the window and resume after the revised setup.',
      storyFactsToApply: ['The reveal remains delayed.'],
      chapterPlanAdjustments: ['Rebuild chapters 8 to 10 around the new midpoint.'],
      volumeImpact: null,
      nextAction: 'replan_window',
      replanRange: {
        startChapter: 8,
        endChapter: 10
      },
      resumeFromChapter: 9,
      invalidateExistingPlans: true
    });
    expect(createRecoveryTaskMock).toHaveBeenCalledWith({
      projectId: 'project-1',
      sessionId: 'session-123',
      startChapter: 8,
      endChapter: 10,
      resumeFromChapter: 9
    });
    expect(createRunMock).toHaveBeenCalledWith({
      flowName: 'chapter-replan-flow',
      projectId: 'project-1',
      chapterNumber: 9
    });
    await app.close();
  });
});
