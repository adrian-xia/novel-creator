import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNovelProject } from '../../packages/domain/src/novel-project';

const createProjectRecord = vi.fn();

vi.mock('../../packages/storage/src/client', () => ({
  prisma: {
    novelProject: {
      create: createProjectRecord
    }
  }
}));

describe('project repository contracts', () => {
  beforeEach(() => {
    createProjectRecord.mockReset();
  });

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

  it('persists a project through the Prisma repository', async () => {
    const { ProjectRepository } = await import(
      '../../packages/storage/src/repositories/project-repository'
    );
    const project = createNovelProject({
      title: '群星边城',
      genre: '科幻',
      premise: '殖民地总督之子被卷入星门战争',
      targetChapterCount: 180,
      chaptersPerDay: 2
    });

    createProjectRecord.mockResolvedValue(project);

    await expect(new ProjectRepository().create(project)).resolves.toEqual(project);
    expect(createProjectRecord).toHaveBeenCalledWith({
      data: project
    });
  });
});
