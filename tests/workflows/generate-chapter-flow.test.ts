import { describe, expect, it } from 'vitest';
import { generateChapterFlow } from '../../packages/workflows/src';

describe('generateChapterFlow', () => {
  it('returns typed steps with executable handlers', () => {
    const flow = generateChapterFlow();

    expect(flow.name).toBe('generate-chapter-flow');
    expect(flow.steps.map((step) => step.name)).toEqual([
      'lock-project-chapter-pipeline',
      'load-story-state',
      'load-chapter-plan-prompt',
      'acquire-capacity',
      'run-chapter-plan-agent',
      'persist-chapter-plan',
      'load-chapter-draft-prompt',
      'run-chapter-draft-agent',
      'persist-chapter-draft',
      'mark-chapter-drafted'
    ]);
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
  });
});
