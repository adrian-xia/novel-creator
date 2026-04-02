import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  chapterPlanRecord: {
    updateMany: vi.fn()
  },
  chapterRecoveryTaskRecord: {
    create: vi.fn()
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
});
