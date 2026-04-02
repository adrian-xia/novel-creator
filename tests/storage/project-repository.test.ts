import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNovelProject } from '../../packages/domain/src/novel-project';

const createProjectRecord = vi.fn();
const findProjectRecord = vi.fn();
const findDecisionQueueRecords = vi.fn();

vi.mock('../../packages/storage/src/client', () => ({
  prisma: {
    novelProject: {
      create: createProjectRecord,
      findUnique: findProjectRecord
    },
    decisionSessionRecord: {
      findMany: findDecisionQueueRecords
    }
  }
}));

describe('project repository contracts', () => {
  beforeEach(() => {
    createProjectRecord.mockReset();
    findProjectRecord.mockReset();
    findDecisionQueueRecords.mockReset();
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

  it('finds a project by id through the Prisma repository', async () => {
    const { ProjectRepository } = await import(
      '../../packages/storage/src/repositories/project-repository'
    );
    const project = createNovelProject({
      title: '天衡余烬',
      genre: '仙侠',
      premise: '废脉弟子从宗门旧案中追索失落真相',
      targetChapterCount: 300,
      chaptersPerDay: 2
    });

    findProjectRecord.mockResolvedValue(project);

    await expect(new ProjectRepository().findById(project.id)).resolves.toEqual(project);
    expect(findProjectRecord).toHaveBeenCalledWith({
      where: { id: project.id }
    });
  });

  it('checks whether a project exists through the Prisma repository', async () => {
    const { ProjectRepository } = await import(
      '../../packages/storage/src/repositories/project-repository'
    );

    findProjectRecord.mockResolvedValue({ id: 'project-123' });

    await expect(new ProjectRepository().exists('project-123')).resolves.toBe(true);
    expect(findProjectRecord).toHaveBeenCalledWith({
      where: { id: 'project-123' }
    });

    findProjectRecord.mockResolvedValue(null);

    await expect(new ProjectRepository().exists('project-missing')).resolves.toBe(false);
    expect(findProjectRecord).toHaveBeenCalledWith({
      where: { id: 'project-missing' }
    });
  });

  it('returns the decision queue ordered by latest session activity', async () => {
    const { ProjectRepository } = await import(
      '../../packages/storage/src/repositories/project-repository'
    );

    findDecisionQueueRecords.mockResolvedValue([
      {
        id: 'session-1',
        projectId: 'project-1',
        status: 'awaiting_human_input'
      }
    ]);

    await expect(new ProjectRepository().getDecisionQueue()).resolves.toEqual([
      {
        id: 'session-1',
        projectId: 'project-1',
        status: 'awaiting_human_input'
      }
    ]);
    expect(findDecisionQueueRecords).toHaveBeenCalledWith({
      where: {
        status: {
          notIn: ['resolved', 'cancelled']
        }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        project: true
      }
    });
  });
});
