import { describe, expect, it } from 'vitest';
import { generateChapterFlow } from '../../packages/workflows/src';

describe('generateChapterFlow', () => {
  it('defines the chapter plan and draft pipeline', () => {
    expect(generateChapterFlow().steps).toEqual([
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
  });
});
