import { describe, expect, it } from 'vitest';
import { generateOutlineFlow } from '../../packages/workflows/src';

describe('generateOutlineFlow', () => {
  it('returns typed steps with executable handlers', () => {
    const flow = generateOutlineFlow();

    expect(flow.name).toBe('generate-outline-flow');
    expect(flow.steps.map((step) => step.name)).toEqual([
      'load-project-input',
      'load-outline-prompt',
      'run-outline-agent',
      'persist-outline'
    ]);
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
  });
});
