import { describe, expect, it } from 'vitest';
import { createProjectFlow } from '../../packages/workflows/src/create-project-flow';

describe('phase 1 smoke', () => {
  it('exposes the baseline create-project flow', () => {
    expect(createProjectFlow().name).toBe('create-project-flow');
  });
});
