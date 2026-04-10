import { describe, expect, it } from 'vitest';
import { reviewRewriteFlow } from '../../packages/workflows/src';

describe('reviewRewriteFlow', () => {
  it('returns typed steps with executable handlers', () => {
    const flow = reviewRewriteFlow();

    expect(flow.name).toBe('review-rewrite-flow');
    expect(flow.steps.map((step) => step.name)).toEqual(['execute-review-rewrite']);
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
  });
});
