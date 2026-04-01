import type { ChapterState, ReviewOutcome } from '@novel-creator/domain';

export function decideReviewNextState(input: {
  decision: ReviewOutcome['decision'];
  rewriteCount: number;
  triggeredManualDecision: boolean;
}): { chapterState: ChapterState; shouldRewrite: boolean } {
  if (input.decision === 'approve') {
    return { chapterState: 'approved', shouldRewrite: false };
  }

  if (input.triggeredManualDecision || input.rewriteCount >= 2) {
    return { chapterState: 'blocked_for_manual_decision', shouldRewrite: false };
  }

  return { chapterState: 'needs_rewrite', shouldRewrite: true };
}
