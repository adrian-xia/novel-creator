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
}
