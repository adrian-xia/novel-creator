import { describe, expect, it } from 'vitest';
import { buildResolutionDraft } from '../../packages/agent-runtime/src/decision-assistant';

describe('buildResolutionDraft', () => {
  it('turns an accept-alternative resolution into a structured draft', () => {
    const draft = buildResolutionDraft({
      sessionId: 'session-1',
      resolutionType: 'accept_alternative',
      decisionSummary: 'delay reveal to preserve pacing',
      chapterPlanAdjustments: ['delay reveal']
    });

    expect(draft.resolutionType).toBe('accept_alternative');
    expect(draft.nextAction).toBe('replan_chapter');
    expect(draft.chapterPlanAdjustments).toEqual(['delay reveal']);
    expect(draft.storyFactsToApply).toEqual([]);
  });

  it('maps the broader resolution contract to the right next action', () => {
    expect(
      buildResolutionDraft({
        sessionId: 'session-2',
        resolutionType: 'accept_current',
        decisionSummary: 'keep the current chapter direction'
      }).nextAction
    ).toBe('resume_review');

    expect(
      buildResolutionDraft({
        sessionId: 'session-3',
        resolutionType: 'replan_required',
        decisionSummary: 'chapter must be reworked'
      }).nextAction
    ).toBe('replan_chapter');

    expect(
      buildResolutionDraft({
        sessionId: 'session-4',
        resolutionType: 'pause_project',
        decisionSummary: 'pause the project'
      }).nextAction
    ).toBe('pause_project');
  });
});
