import { describe, expect, it } from 'vitest';
import { generateOutlineFlow } from '../../packages/workflows/src';

describe('generateOutlineFlow', () => {
  it('defines the real outline workflow steps', () => {
    expect(generateOutlineFlow().steps).toEqual([
      'load-project-input',
      'load-outline-prompt',
      'acquire-capacity',
      'run-outline-agent',
      'validate-outline-output',
      'persist-outline',
      'record-agent-run'
    ]);
  });
});
