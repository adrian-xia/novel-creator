import type { DecisionResolution } from '@novel-creator/domain';

export type ResolutionDraftInput = {
  sessionId: string;
  resolutionType:
    | 'accept_current'
    | 'accept_alternative'
    | 'replan_required'
    | 'pause_project';
  decisionSummary: string;
  storyFactsToApply?: string[];
  chapterPlanAdjustments?: string[];
  volumeImpact?: string | null;
  replanRange?: {
    startChapter: number;
    endChapter: number;
  } | null;
};

function deriveNextAction(input: ResolutionDraftInput) {
  if (input.resolutionType === 'pause_project') {
    return 'pause_project';
  }

  return input.replanRange ? 'replan_window' : 'resume_current_chapter';
}

export function buildResolutionDraft(input: ResolutionDraftInput): DecisionResolution {
  const replanRange = input.replanRange ?? null;

  return {
    sessionId: input.sessionId,
    resolutionType: input.resolutionType,
    decisionSummary: input.decisionSummary,
    storyFactsToApply: input.storyFactsToApply ?? [],
    chapterPlanAdjustments: input.chapterPlanAdjustments ?? [],
    volumeImpact: input.volumeImpact ?? null,
    nextAction: deriveNextAction(input),
    replanRange,
    resumeFromChapter: replanRange ? replanRange.startChapter : null,
    invalidateExistingPlans: Boolean(replanRange)
  };
}
