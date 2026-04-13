import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  chapterPlanRecord: {
    updateMany: vi.fn()
  },
  chapterRecoveryTaskRecord: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('DecisionRecoveryRepository', () => {
  beforeEach(() => {
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma)
    );
    prisma.chapterPlanRecord.updateMany.mockReset();
    prisma.chapterRecoveryTaskRecord.create.mockReset();
    prisma.chapterRecoveryTaskRecord.findFirst.mockReset();
    prisma.chapterRecoveryTaskRecord.update.mockReset();
  });

  it('creates a recovery task and invalidates chapter plans in the replan window', async () => {
    prisma.chapterPlanRecord.updateMany.mockResolvedValue({ count: 4 });
    prisma.chapterRecoveryTaskRecord.create.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      startChapter: 12,
      endChapter: 15,
      resumeFromChapter: 12,
      status: 'pending'
    });

    const { DecisionRecoveryRepository } = await import(
      '../../packages/storage/src/repositories/decision-recovery-repository'
    );
    const repository = new DecisionRecoveryRepository();

    const task = await repository.createRecoveryTask({
      projectId: 'project-1',
      sessionId: 'session-1',
      startChapter: 12,
      endChapter: 15,
      resumeFromChapter: 12
    });

    expect(prisma.chapterPlanRecord.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        chapterNumber: {
          gte: 12,
          lte: 15
        }
      },
      data: {
        invalidatedAt: expect.any(Date)
      }
    });
    expect(prisma.chapterRecoveryTaskRecord.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-1',
        sessionId: 'session-1',
        startChapter: 12,
        endChapter: 15,
        resumeFromChapter: 12,
        status: 'pending'
      }
    });
    expect(task.status).toBe('pending');
  });

  it('loads the latest pending recovery task for a project', async () => {
    prisma.chapterRecoveryTaskRecord.findFirst.mockResolvedValue({
      id: 'task-2',
      projectId: 'project-1',
      sessionId: 'session-2',
      startChapter: 9,
      endChapter: 11,
      resumeFromChapter: 10,
      status: 'pending'
    });

    const { DecisionRecoveryRepository } = await import(
      '../../packages/storage/src/repositories/decision-recovery-repository'
    );
    const repository = new DecisionRecoveryRepository();

    const task = await repository.findLatestPendingTask('project-1');

    expect(prisma.chapterRecoveryTaskRecord.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        status: 'pending'
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
    expect(task?.id).toBe('task-2');
  });

  it('marks recovery tasks running and completed', async () => {
    prisma.chapterRecoveryTaskRecord.update
      .mockResolvedValueOnce({ id: 'task-3', status: 'running' })
      .mockResolvedValueOnce({ id: 'task-3', status: 'completed' });

    const { DecisionRecoveryRepository } = await import(
      '../../packages/storage/src/repositories/decision-recovery-repository'
    );
    const repository = new DecisionRecoveryRepository();

    await repository.markTaskRunning('task-3');
    await repository.markTaskCompleted('task-3');

    expect(prisma.chapterRecoveryTaskRecord.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'task-3' },
      data: {
        status: 'running'
      }
    });
    expect(prisma.chapterRecoveryTaskRecord.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'task-3' },
      data: {
        status: 'completed'
      }
    });
  });
});
