import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  decisionSessionRecord: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  decisionMessageRecord: {
    create: vi.fn(),
    findFirst: vi.fn()
  },
  decisionResolutionRecord: {
    upsert: vi.fn()
  }
}));

let sessionState: {
  id: string;
  projectId: string;
  chapterNumber: number;
  triggerReason: string | null;
  sourceReviewOutcomeId: string | null;
  status: string;
  packet: Record<string, unknown>;
  contextSnapshot: Record<string, unknown>;
  currentDraftResolution: Record<string, unknown> | null;
  resolvedAt: Date | null;
  updatedAt: Date;
  messages: Array<{
    sessionId: string;
    sequence: number;
    role: string;
    messageType: string;
    content: string;
  }>;
  resolution: null | {
    sessionId: string;
    resolutionType: string;
    nextAction: string;
    replanRangeStartChapter: number | null;
    replanRangeEndChapter: number | null;
    resumeFromChapter: number | null;
    invalidateExistingPlans: boolean;
  };
};

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('DecisionSessionRepository', () => {
  beforeEach(() => {
    sessionState = {
      id: 'decision-session-1',
      projectId: 'project-1',
      chapterNumber: 8,
      triggerReason: null,
      sourceReviewOutcomeId: null,
      status: 'open',
      packet: { summary: 'blocked twist' },
      contextSnapshot: {},
      currentDraftResolution: null,
      resolvedAt: null,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      messages: [],
      resolution: null
    };

    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma)
    );

    Object.values(prisma).forEach((model) => {
      if (typeof model === 'function') {
        return;
      }

      Object.values(model).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          fn.mockReset();
        }
      });
    });
  });

  it('persists sequenced messages and stores a draft resolution on the session', async () => {
    prisma.decisionSessionRecord.create.mockImplementation(async ({ data }) => {
      sessionState = {
        ...sessionState,
        ...data,
        id: 'decision-session-1',
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      };

      return sessionState;
    });
    prisma.decisionSessionRecord.update.mockImplementation(async ({ data }) => {
      sessionState = {
        ...sessionState,
        ...data
      };

      return sessionState;
    });
    prisma.decisionSessionRecord.findUnique.mockImplementation(async () => ({
      ...sessionState,
      messages: [...sessionState.messages],
      resolution: sessionState.resolution
    }));

    let releaseMessageCreate!: () => void;
    const messageCreateGate = new Promise<void>((resolve) => {
      releaseMessageCreate = resolve;
    });
    prisma.decisionMessageRecord.findFirst.mockResolvedValue(null);
    prisma.decisionMessageRecord.create.mockImplementation(async ({ data }) => {
      await messageCreateGate;
      sessionState.messages = [...sessionState.messages, data];
      return { id: 'message-1', ...data };
    });

    const { DecisionSessionRepository } = await import(
      '../../packages/storage/src/repositories/decision-session-repository'
    );
    const repository = new DecisionSessionRepository();

    const session = await repository.createSession({
      projectId: 'project-1',
      chapterNumber: 8,
      packet: { summary: 'blocked twist' },
      triggerReason: 'critical_reversal',
      sourceReviewOutcomeId: 'review-1',
      contextSnapshot: { chapterNumber: 8 }
    });

    const appendPromise = repository.appendMessage({
      sessionId: session.id,
      sequence: 1,
      role: 'human',
      messageType: 'human',
      content: 'Give me a safer alternative'
    });

    await repository.saveDraftResolution(session.id, {
      resolutionType: 'accept_alternative',
      decisionSummary: 'Delay the reveal by one chapter',
      replanRange: { startChapter: 8, endChapter: 10 },
      resumeFromChapter: 8,
      invalidateExistingPlans: true
    });

    releaseMessageCreate();
    await appendPromise;

    expect(prisma.decisionSessionRecord.findUnique).not.toHaveBeenCalled();
    expect(prisma.decisionSessionRecord.update).toHaveBeenCalledWith({
      where: { id: session.id },
      data: { updatedAt: expect.any(Date) }
    });
    expect(prisma.decisionSessionRecord.update).toHaveBeenCalledWith({
      where: { id: session.id },
      data: {
        currentDraftResolution: {
          resolutionType: 'accept_alternative',
          decisionSummary: 'Delay the reveal by one chapter',
          replanRange: { startChapter: 8, endChapter: 10 },
          resumeFromChapter: 8,
          invalidateExistingPlans: true
        },
        status: 'awaiting_resolution_confirmation'
      }
    });

    const detail = await repository.getSessionDetail(session.id);
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.messages[0]?.sequence).toBe(1);
    expect(detail?.messages[0]?.messageType).toBe('human');
    expect(detail?.currentDraftResolution).toMatchObject({
      resolutionType: 'accept_alternative'
    });
    expect(detail?.status).toBe('awaiting_resolution_confirmation');
    expect(sessionState.status).toBe('awaiting_resolution_confirmation');
  });

  it('owns message sequencing instead of trusting caller-provided sequence numbers', async () => {
    prisma.decisionMessageRecord.findFirst
      .mockResolvedValueOnce({ sequence: 0 })
      .mockResolvedValueOnce({ sequence: 1 });
    prisma.decisionMessageRecord.create.mockImplementation(async ({ data }) => {
      sessionState.messages = [...sessionState.messages, data];
      return { id: `message-${data.sequence}`, ...data };
    });
    prisma.decisionSessionRecord.update.mockImplementation(async ({ data }) => {
      sessionState = {
        ...sessionState,
        ...data
      };

      return sessionState;
    });

    const { DecisionSessionRepository } = await import(
      '../../packages/storage/src/repositories/decision-session-repository'
    );
    const repository = new DecisionSessionRepository();

    await repository.appendMessage({
      sessionId: sessionState.id,
      sequence: 99,
      role: 'human',
      messageType: 'human',
      content: 'first'
    });

    await repository.appendMessage({
      sessionId: sessionState.id,
      sequence: 99,
      role: 'assistant',
      messageType: 'assistant',
      content: 'second'
    });

    expect(prisma.decisionMessageRecord.findFirst).toHaveBeenNthCalledWith(1, {
      where: { sessionId: sessionState.id },
      orderBy: { sequence: 'desc' },
      select: { sequence: true }
    });
    expect(prisma.decisionMessageRecord.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        sessionId: sessionState.id,
        sequence: 1,
        role: 'human',
        messageType: 'human'
      })
    });
    expect(prisma.decisionMessageRecord.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        sessionId: sessionState.id,
        sequence: 2,
        role: 'assistant',
        messageType: 'assistant'
      })
    });
  });

  it('persists full phase-4 resolution fields and marks the session resolved', async () => {
    prisma.decisionResolutionRecord.upsert.mockImplementation(async ({ create }) => {
      sessionState.resolution = {
        sessionId: create.sessionId,
        resolutionType: create.resolutionType,
        nextAction: create.nextAction,
        replanRangeStartChapter: create.replanRangeStartChapter,
        replanRangeEndChapter: create.replanRangeEndChapter,
        resumeFromChapter: create.resumeFromChapter,
        invalidateExistingPlans: create.invalidateExistingPlans
      };
      return create;
    });
    prisma.decisionSessionRecord.update.mockImplementation(async ({ data }) => {
      sessionState = {
        ...sessionState,
        ...data
      };

      return sessionState;
    });

    const { DecisionSessionRepository } = await import(
      '../../packages/storage/src/repositories/decision-session-repository'
    );
    const repository = new DecisionSessionRepository();

    await repository.saveResolution({
      sessionId: sessionState.id,
      resolutionType: 'replan_required',
      decisionSummary: 'Delay the reveal by one chapter',
      storyFactsToApply: ['villain identity remains hidden'],
      chapterPlanAdjustments: ['shift reveal to chapter 9'],
      volumeImpact: null,
      nextAction: 'replan_window',
      replanRange: { startChapter: 8, endChapter: 10 },
      resumeFromChapter: 8,
      invalidateExistingPlans: true
    });

    expect(prisma.decisionResolutionRecord.upsert).toHaveBeenCalledWith({
      where: { sessionId: sessionState.id },
      create: expect.objectContaining({
        sessionId: sessionState.id,
        nextAction: 'replan_window',
        replanRangeStartChapter: 8,
        replanRangeEndChapter: 10,
        resumeFromChapter: 8,
        invalidateExistingPlans: true
      }),
      update: expect.objectContaining({
        nextAction: 'replan_window',
        replanRangeStartChapter: 8,
        replanRangeEndChapter: 10,
        resumeFromChapter: 8,
        invalidateExistingPlans: true
      })
    });
    expect(prisma.decisionSessionRecord.update).toHaveBeenCalledWith({
      where: { id: sessionState.id },
      data: expect.objectContaining({
        status: 'resolved',
        resolvedAt: expect.any(Date)
      })
    });
  });

  it('rehydrates flattened resolution fields when reading session detail', async () => {
    sessionState.resolution = {
      sessionId: sessionState.id,
      resolutionType: 'replan_required',
      nextAction: 'replan_window',
      replanRangeStartChapter: 8,
      replanRangeEndChapter: 10,
      resumeFromChapter: 8,
      invalidateExistingPlans: true
    };
    prisma.decisionSessionRecord.findUnique.mockResolvedValue({
      ...sessionState,
      messages: [...sessionState.messages],
      resolution: sessionState.resolution
    });

    const { DecisionSessionRepository } = await import(
      '../../packages/storage/src/repositories/decision-session-repository'
    );
    const repository = new DecisionSessionRepository();

    const detail = await repository.getSessionDetail(sessionState.id);

    expect(detail?.resolution).toMatchObject({
      sessionId: sessionState.id,
      nextAction: 'replan_window',
      replanRange: { startChapter: 8, endChapter: 10 },
      resumeFromChapter: 8,
      invalidateExistingPlans: true
    });
  });

  it('creates a blocking decision trigger through the session creation boundary', async () => {
    prisma.decisionSessionRecord.create.mockImplementation(async ({ data }) => {
      sessionState = {
        ...sessionState,
        ...data,
        id: 'decision-session-2',
        updatedAt: new Date('2026-01-02T00:00:00.000Z')
      };

      return sessionState;
    });

    const { DecisionSessionRepository } = await import(
      '../../packages/storage/src/repositories/decision-session-repository'
    );
    const repository = new DecisionSessionRepository();

    await repository.createBlockingDecisionTrigger({
      projectId: 'project-1',
      chapterNumber: 8,
      triggerReason: 'review_blocked',
      packet: {
        projectId: 'project-1',
        chapterNumber: 8,
        reason: 'rewrite limit reached'
      }
    });

    expect(prisma.decisionSessionRecord.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-1',
        chapterNumber: 8,
        status: 'open',
        packet: {
          projectId: 'project-1',
          chapterNumber: 8,
          reason: 'rewrite limit reached'
        },
        triggerReason: 'review_blocked',
        sourceReviewOutcomeId: null,
        contextSnapshot: {
          projectId: 'project-1',
          chapterNumber: 8,
          reason: 'rewrite limit reached'
        },
        currentDraftResolution: null
      }
    });
  });
});
