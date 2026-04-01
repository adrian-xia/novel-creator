import { describe, expect, it } from 'vitest';
import { generateVolumeFlow } from '../../packages/workflows/src';

describe('generateVolumeFlow', () => {
  it('defines the real volume workflow steps', () => {
    expect(generateVolumeFlow().steps).toEqual([
      'load-outline',
      'load-volume-prompt',
      'acquire-capacity',
      'run-volume-agent',
      'validate-volume-output',
      'persist-volume-plans',
      'record-agent-run'
    ]);
  });
});
