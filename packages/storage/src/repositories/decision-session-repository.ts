import type { DecisionMessage, DecisionResolution } from '@novel-creator/domain';
import { prisma } from '../client';

export class DecisionSessionRepository {
  async createSession(input: {
    projectId: string;
    chapterNumber: number;
    packet: Record<string, unknown>;
  }) {
    return prisma.decisionSessionRecord.create({
      data: {
        projectId: input.projectId,
        chapterNumber: input.chapterNumber,
        status: 'open',
        packet: input.packet
      }
    });
  }

  async appendMessage(message: DecisionMessage) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.decisionSessionRecord.findUnique({
        where: { id: message.sessionId },
        select: { status: true }
      });

      if (!session) {
        throw new Error(`Decision session not found: ${message.sessionId}`);
      }

      const appendedMessage = await tx.decisionMessageRecord.create({
        data: {
          sessionId: message.sessionId,
          role: message.role,
          content: message.content,
          ...(message.createdAt ? { createdAt: message.createdAt } : {})
        }
      });

      await tx.decisionSessionRecord.update({
        where: { id: message.sessionId },
        data: {
          status: session.status
        }
      });

      return appendedMessage;
    });
  }

  async saveResolution(resolution: DecisionResolution) {
    return prisma.$transaction(async (tx) => {
      await tx.decisionResolutionRecord.upsert({
        where: { sessionId: resolution.sessionId },
        create: resolution,
        update: resolution
      });

      return tx.decisionSessionRecord.update({
        where: { id: resolution.sessionId },
        data: { status: 'resolved' }
      });
    });
  }

  async getSessionDetail(sessionId: string) {
    return prisma.decisionSessionRecord.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        resolution: true
      }
    });
  }
}
