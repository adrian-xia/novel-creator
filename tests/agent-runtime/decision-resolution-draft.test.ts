import { describe, expect, it } from 'vitest';
import { buildResolutionDraftFromConversation } from '../../packages/agent-runtime/src/decision-resolution-draft';

describe('buildResolutionDraftFromConversation', () => {
  it('creates a structured replan draft with resume metadata', () => {
    const draft = buildResolutionDraftFromConversation({
      sessionId: 'session-11',
      resolutionType: 'accept_alternative',
      decisionSummary: 'shift the confrontation to chapter 10',
      chapterPlanAdjustments: ['move the confrontation later'],
      replanRange: { startChapter: 10, endChapter: 12 }
    });

    expect(draft).toEqual({
      sessionId: 'session-11',
      resolutionType: 'accept_alternative',
      decisionSummary: 'shift the confrontation to chapter 10',
      storyFactsToApply: [],
      chapterPlanAdjustments: ['move the confrontation later'],
      volumeImpact: null,
      nextAction: 'replan_window',
      replanRange: { startChapter: 10, endChapter: 12 },
      resumeFromChapter: 10,
      invalidateExistingPlans: true
    });
  });

  it('requires a replan range for replan-required resolutions', () => {
    expect(() =>
      buildResolutionDraftFromConversation({
        sessionId: 'session-12',
        resolutionType: 'replan_required',
        decisionSummary: 'the current branch cannot continue'
      })
    ).toThrowError('replan_required requires a replanRange');
  });

  it('keeps non-replan resolutions resumable without invalidating plans', () => {
    const draft = buildResolutionDraftFromConversation({
      sessionId: 'session-13',
      resolutionType: 'accept_current',
      decisionSummary: 'stay on the current direction',
      storyFactsToApply: ['the witness already saw the exchange']
    });

    expect(draft.nextAction).toBe('resume_current_chapter');
    expect(draft.storyFactsToApply).toEqual(['the witness already saw the exchange']);
    expect(draft.replanRange).toBeNull();
    expect(draft.resumeFromChapter).toBeNull();
    expect(draft.invalidateExistingPlans).toBe(false);
  });
});
