import { describe, expect, it } from 'vitest';
import { reviewRewriteFlow } from '../../packages/workflows/src';

describe('reviewRewriteFlow', () => {
  it('defines a bounded review and rewrite loop entry', () => {
    expect(reviewRewriteFlow().steps).toEqual([
      'load-chapter-draft',
      'load-review-prompt',
      'acquire-capacity',
      'run-review-agent',
      'persist-review-outcome',
      'branch-on-review-decision'
    ]);
  });
});
