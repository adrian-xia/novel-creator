import { describe, expect, it } from 'vitest';
import { decideReviewNextState } from '../../packages/workflows/src/review-policy';

describe('decideReviewNextState', () => {
  it('blocks after the second rewrite request', () => {
    expect(
      decideReviewNextState({
        decision: 'rewrite',
        rewriteCount: 2,
        triggeredManualDecision: false
      })
    ).toEqual({
      chapterState: 'blocked_for_manual_decision',
      shouldRewrite: false
    });
  });

  it('approves a clean review result', () => {
    expect(
      decideReviewNextState({
        decision: 'approve',
        rewriteCount: 0,
        triggeredManualDecision: false
      })
    ).toEqual({
      chapterState: 'approved',
      shouldRewrite: false
    });
  });
});
