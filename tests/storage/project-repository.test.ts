import { describe, expect, it } from 'vitest';
import { createNovelProject } from '../../packages/domain/src/novel-project';

describe('project repository contracts', () => {
  it('creates a new draft project payload', () => {
    const project = createNovelProject({
      title: '北境长夜',
      genre: '玄幻',
      premise: '边境少年卷入王朝与异族战争',
      targetChapterCount: 240,
      chaptersPerDay: 3
    });

    expect(project.status).toBe('draft');
    expect(project.targetChapterCount).toBe(240);
  });
});
