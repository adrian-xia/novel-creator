import { describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('decision session resolution routes', () => {
  it('generates a structured resolution draft for confirmation', async () => {
    const app = buildApp();

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
  });

  it('rejects an invalid resolution draft payload', async () => {
    const app = buildApp();

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
  });

  it('rejects pause_project drafts that carry replan metadata', async () => {
    const app = buildApp();

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
  });

  it('accepts a confirmed resolution payload and returns the resolved route shape', async () => {
    const app = buildApp();

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
      }
    });
  });

  it('rejects an invalid confirmed resolution payload', async () => {
    const app = buildApp();

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
  });

  it('accepts a replan resolution when resumeFromChapter is within the replan range', async () => {
    const app = buildApp();

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
      }
    });
  });
});
