import { describe, expect, it } from 'vitest';
import { buildResolutionDraft } from '../../packages/agent-runtime/src/decision-assistant';

describe('buildResolutionDraft', () => {
  it('turns an accept-alternative resolution with a replan range into a structured draft', () => {
    const draft = buildResolutionDraft({
      sessionId: 'session-1',
      resolutionType: 'accept_alternative',
      decisionSummary: 'delay reveal to preserve pacing',
      chapterPlanAdjustments: ['delay reveal'],
      replanRange: { startChapter: 8, endChapter: 10 }
    });

    expect(draft.resolutionType).toBe('accept_alternative');
    expect(draft.nextAction).toBe('replan_window');
    expect(draft.chapterPlanAdjustments).toEqual(['delay reveal']);
    expect(draft.storyFactsToApply).toEqual([]);
    expect(draft.replanRange).toEqual({ startChapter: 8, endChapter: 10 });
    expect(draft.resumeFromChapter).toBe(8);
    expect(draft.invalidateExistingPlans).toBe(true);
  });

  it('maps the broader resolution contract to the right next action', () => {
    expect(
      buildResolutionDraft({
        sessionId: 'session-2',
        resolutionType: 'accept_current',
        decisionSummary: 'keep the current chapter direction'
      }).nextAction
    ).toBe('resume_current_chapter');

    expect(
      buildResolutionDraft({
        sessionId: 'session-3',
        resolutionType: 'replan_required',
        decisionSummary: 'chapter must be reworked'
      }).nextAction
    ).toBe('resume_current_chapter');

    expect(
      buildResolutionDraft({
        sessionId: 'session-4',
        resolutionType: 'pause_project',
        decisionSummary: 'pause the project'
      }).nextAction
    ).toBe('pause_project');
  });

  it('leaves replan-specific fields empty when no replan range is provided', () => {
    const draft = buildResolutionDraft({
      sessionId: 'session-5',
      resolutionType: 'accept_current',
      decisionSummary: 'keep the current chapter direction'
    });

    expect(draft.replanRange).toBeNull();
    expect(draft.resumeFromChapter).toBeNull();
    expect(draft.invalidateExistingPlans).toBe(false);
  });
});
