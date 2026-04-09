import { describe, expect, it } from 'vitest';
import { generateVolumeFlow } from '../../packages/workflows/src';

describe('generateVolumeFlow', () => {
  it('returns typed steps with executable handlers', () => {
    const flow = generateVolumeFlow();

    expect(flow.name).toBe('generate-volume-flow');
    expect(flow.steps.map((step) => step.name)).toEqual([
      'load-outline',
      'load-volume-prompt',
      'run-volume-agent',
      'validate-volume-output',
      'persist-volume-plans'
    ]);
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
  });
});
