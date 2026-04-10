import type { DecisionMessage, DecisionResolution } from '@novel-creator/domain';
import { prisma } from '../client';

const SERIALIZABLE_ISOLATION_LEVEL = 'Serializable' as const;
type GateOptionRecord = Record<string, unknown> & { optionId?: string };

function hasOptionId(options: GateOptionRecord[], optionId: string | null) {
  if (optionId === null) {
    return true;
  }

  return options.some((option) => option.optionId === optionId);
}

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

  async createBlockingDecisionTrigger(input: {
    projectId: string;
    chapterNumber: number;
    triggerReason: string;
    packet: Record<string, unknown>;
  }) {
    return this.createSession({
      projectId: input.projectId,
      chapterNumber: input.chapterNumber,
      packet: input.packet,
      triggerReason: input.triggerReason,
      sourceReviewOutcomeId: null,
      contextSnapshot: input.packet
    });
  }

  async createHumanGateSession(input: {
    projectId: string;
    chapterNumber: number | null;
    gateType: string;
    triggerReason: string | null;
    packet?: Record<string, unknown>;
    contextSnapshot: Record<string, unknown>;
    options: GateOptionRecord[];
    recommendedOptionId: string | null;
  }) {
    if (!hasOptionId(input.options, input.recommendedOptionId)) {
      throw new Error(`Recommended option ${input.recommendedOptionId} does not exist in gate options`);
    }

    return prisma.decisionSessionRecord.create({
      data: {
        projectId: input.projectId,
        chapterNumber: input.chapterNumber,
        gateType: input.gateType,
        triggerReason: input.triggerReason,
        status: 'open',
        packet: input.packet ?? input.contextSnapshot,
        contextSnapshot: input.contextSnapshot,
        options: input.options,
        recommendedOptionId: input.recommendedOptionId,
        selectedOptionId: null,
        humanNotes: null,
        sourceReviewOutcomeId: null,
        currentDraftResolution: null
      }
    });
  }

  async appendMessage(message: DecisionMessage) {
    return prisma.$transaction(async (tx) => {
      const latestMessage = await tx.decisionMessageRecord.findFirst({
        where: { sessionId: message.sessionId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true }
      });
      const nextSequence = (latestMessage?.sequence ?? 0) + 1;

      const appendedMessage = await tx.decisionMessageRecord.create({
        data: {
          sessionId: message.sessionId,
          sequence: nextSequence,
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
    }, {
      isolationLevel: SERIALIZABLE_ISOLATION_LEVEL
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

  async confirmHumanGate(sessionId: string, input: {
    selectedOptionId: string;
    humanNotes: string | null;
  }) {
    const session = await prisma.decisionSessionRecord.findUnique({
      where: { id: sessionId },
      select: { options: true }
    });

    if (!session) {
      throw new Error(`Decision session ${sessionId} was not found`);
    }

    if (!hasOptionId(session.options as GateOptionRecord[], input.selectedOptionId)) {
      throw new Error(`Selected option ${input.selectedOptionId} does not exist in gate options`);
    }

    return prisma.decisionSessionRecord.update({
      where: { id: sessionId },
      data: {
        status: 'resolved',
        selectedOptionId: input.selectedOptionId,
        humanNotes: input.humanNotes,
        resolvedAt: new Date()
      }
    });
  }
}
