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
};

function deriveNextAction(input: ResolutionDraftInput['resolutionType']) {
  switch (input) {
    case 'accept_current':
      return 'resume_review';
    case 'pause_project':
      return 'pause_project';
    case 'accept_alternative':
    case 'replan_required':
      return 'replan_chapter';
  }
}

export function buildResolutionDraft(input: ResolutionDraftInput): DecisionResolution {
  return {
    sessionId: input.sessionId,
    resolutionType: input.resolutionType,
    decisionSummary: input.decisionSummary,
    storyFactsToApply: input.storyFactsToApply ?? [],
    chapterPlanAdjustments: input.chapterPlanAdjustments ?? [],
    volumeImpact: input.volumeImpact ?? null,
    nextAction: deriveNextAction(input.resolutionType)
  };
}
