import { describe, expect, it } from 'vitest';
import { createProjectFlow } from '../../packages/workflows/src/create-project-flow';

describe('createProjectFlow', () => {
  it('returns the initial workflow step list', () => {
    const flow = createProjectFlow();

    expect(flow.steps).toEqual([
      'persist-project',
      'enqueue-outline',
      'mark-project-active'
    ]);
  });
});
