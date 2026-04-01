import type { DecisionResolution } from '@novel-creator/domain';

export function buildResolutionDraft(input: {
  sessionId: string;
  direction: string;
  rationale: string;
}): DecisionResolution {
  const keepCurrent = input.direction === 'keep current';

  return {
    sessionId: input.sessionId,
    resolutionType: keepCurrent ? 'accept_current' : 'accept_alternative',
    decisionSummary: `${input.direction}: ${input.rationale}`,
    storyFactsToApply: [],
    chapterPlanAdjustments: keepCurrent ? [] : [input.direction],
    volumeImpact: null,
    nextAction: keepCurrent ? 'resume_review' : 'replan_chapter'
  };
}
