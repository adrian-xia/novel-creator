import { describe, expect, it } from 'vitest';
import { publishChapterFlow } from '../../packages/workflows/src/publish-chapter-flow';

describe('publishChapterFlow', () => {
  it('expands tasks and branches into adapter publish or export', () => {
    const flow = publishChapterFlow();
    expect(flow.name).toBe('publish-chapter-flow');
    expect(flow.steps.map((step) => step.name)).toEqual([
      'load-publish-profile',
      'expand-publish-tasks',
      'run-adapter-publishes',
      'run-manual-exports',
      'persist-publish-results'
    ]);
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
  });
});
