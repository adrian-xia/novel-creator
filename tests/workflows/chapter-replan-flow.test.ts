import { describe, expect, it } from 'vitest';
import { chapterReplanFlow } from '../../packages/workflows/src/chapter-replan-flow';

describe('chapterReplanFlow', () => {
  it('defines the recovery replan lifecycle', () => {
    const flow = chapterReplanFlow();

    expect(flow.name).toBe('chapter-replan-flow');
    expect(flow.steps.map((step) => step.name)).toEqual([
      'load-recovery-task',
      'invalidate-plans-in-window',
      'set-chapters-needs-replan',
      'enqueue-replan-window',
      'mark-recovery-task-complete'
    ]);
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
  });
});
