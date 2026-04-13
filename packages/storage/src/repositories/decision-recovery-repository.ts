import { prisma } from '../client';

export class DecisionRecoveryRepository {
  async createRecoveryTask(input: {
    projectId: string;
    sessionId: string;
    startChapter: number;
    endChapter: number;
    resumeFromChapter: number;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.chapterPlanRecord.updateMany({
        where: {
          projectId: input.projectId,
          chapterNumber: {
            gte: input.startChapter,
            lte: input.endChapter
          }
        },
        data: {
          invalidatedAt: new Date()
        }
      });

      return tx.chapterRecoveryTaskRecord.create({
        data: {
          ...input,
          status: 'pending'
        }
      });
    });
  }

  async findLatestPendingTask(projectId: string) {
    return prisma.chapterRecoveryTaskRecord.findFirst({
      where: {
        projectId,
        status: 'pending'
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async markTaskRunning(taskId: string) {
    return prisma.chapterRecoveryTaskRecord.update({
      where: { id: taskId },
      data: {
        status: 'running'
      }
    });
  }

  async markTaskCompleted(taskId: string) {
    return prisma.chapterRecoveryTaskRecord.update({
      where: { id: taskId },
      data: {
        status: 'completed'
      }
    });
  }
}
