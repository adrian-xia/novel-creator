import { describe, expect, it } from 'vitest';
import { generateChapterFlow } from '../../packages/workflows/src';

describe('generateChapterFlow', () => {
  it('returns typed steps with executable handlers', () => {
    const flow = generateChapterFlow();

    expect(flow.name).toBe('generate-chapter-flow');
    expect(flow.steps.map((step) => step.name)).toEqual([
      'execute-chapter-generation',
      'execute-review-rewrite'
    ]);
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
  });
});
