import type { DecisionMessage, DecisionResolution } from '@novel-creator/domain';
import { prisma } from '../client';

function rehydrateResolution<T extends {
  replanRangeStartChapter?: number | null;
  replanRangeEndChapter?: number | null;
  resumeFromChapter?: number | null;
  invalidateExistingPlans?: boolean;
} | null>(resolution: T) {
  if (!resolution) {
    return resolution;
  }

  const startChapter = resolution.replanRangeStartChapter ?? null;
  const endChapter = resolution.replanRangeEndChapter ?? null;

  return {
    ...resolution,
    replanRange:
      startChapter !== null && endChapter !== null
        ? { startChapter, endChapter }
        : null
  };
}

export class DecisionSessionRepository {
  async createSession(input: {
    projectId: string;
    chapterNumber: number;
    packet: Record<string, unknown>;
    triggerReason: string | null;
    sourceReviewOutcomeId: string | null;
    contextSnapshot: Record<string, unknown>;
  }) {
    return prisma.decisionSessionRecord.create({
      data: {
        projectId: input.projectId,
        chapterNumber: input.chapterNumber,
        status: 'open',
        packet: input.packet,
        triggerReason: input.triggerReason,
        sourceReviewOutcomeId: input.sourceReviewOutcomeId,
        contextSnapshot: input.contextSnapshot,
        currentDraftResolution: null
      }
    });
  }

  async appendMessage(message: DecisionMessage) {
    return prisma.$transaction(async (tx) => {
      const appendedMessage = await tx.decisionMessageRecord.create({
        data: {
          sessionId: message.sessionId,
          sequence: message.sequence,
          role: message.role,
          messageType: message.messageType,
          content: message.content,
          ...(message.createdAt ? { createdAt: message.createdAt } : {})
        }
      });

      await tx.decisionSessionRecord.update({
        where: { id: message.sessionId },
        data: {
          updatedAt: new Date()
        }
      });

      return appendedMessage;
    });
  }

  async saveDraftResolution(sessionId: string, draft: Record<string, unknown>) {
    return prisma.decisionSessionRecord.update({
      where: { id: sessionId },
      data: {
        currentDraftResolution: draft,
        status: 'awaiting_resolution_confirmation'
      }
    });
  }

  async saveResolution(resolution: DecisionResolution) {
    const replanRangeStartChapter = resolution.replanRange?.startChapter ?? null;
    const replanRangeEndChapter = resolution.replanRange?.endChapter ?? null;

    return prisma.$transaction(async (tx) => {
      await tx.decisionResolutionRecord.upsert({
        where: { sessionId: resolution.sessionId },
        create: {
          sessionId: resolution.sessionId,
          resolutionType: resolution.resolutionType,
          decisionSummary: resolution.decisionSummary,
          storyFactsToApply: resolution.storyFactsToApply,
          chapterPlanAdjustments: resolution.chapterPlanAdjustments,
          volumeImpact: resolution.volumeImpact,
          nextAction: resolution.nextAction,
          replanRangeStartChapter,
          replanRangeEndChapter,
          resumeFromChapter: resolution.resumeFromChapter,
          invalidateExistingPlans: resolution.invalidateExistingPlans
        },
        update: {
          resolutionType: resolution.resolutionType,
          decisionSummary: resolution.decisionSummary,
          storyFactsToApply: resolution.storyFactsToApply,
          chapterPlanAdjustments: resolution.chapterPlanAdjustments,
          volumeImpact: resolution.volumeImpact,
          nextAction: resolution.nextAction,
          replanRangeStartChapter,
          replanRangeEndChapter,
          resumeFromChapter: resolution.resumeFromChapter,
          invalidateExistingPlans: resolution.invalidateExistingPlans
        }
      });

      return tx.decisionSessionRecord.update({
        where: { id: resolution.sessionId },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          currentDraftResolution: null
        }
      });
    });
  }

  async listSessions() {
    const sessions = await prisma.decisionSessionRecord.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { sequence: 'asc' } },
        resolution: true
      }
    });

    return sessions.map((session) => ({
      ...session,
      resolution: rehydrateResolution(session.resolution)
    }));
  }

  async getSessionDetail(sessionId: string) {
    const session = await prisma.decisionSessionRecord.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { sequence: 'asc' } },
        resolution: true
      }
    });

    if (!session) {
      return null;
    }

    return {
      ...session,
      resolution: rehydrateResolution(session.resolution)
    };
  }

  async cancelSession(sessionId: string) {
    return prisma.decisionSessionRecord.update({
      where: { id: sessionId },
      data: { status: 'cancelled' }
    });
  }
}
