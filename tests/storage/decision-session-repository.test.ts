import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  decisionSessionRecord: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  decisionMessageRecord: {
    create: vi.fn()
  },
  decisionResolutionRecord: {
    upsert: vi.fn()
  }
}));

let sessionState: {
  id: string;
  projectId: string;
  chapterNumber: number;
  status: string;
  packet: Record<string, unknown>;
  updatedAt: Date;
  messages: Array<{ sessionId: string; role: string; content: string }>;
  resolution: null | { sessionId: string; resolutionType: string };
};

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('DecisionSessionRepository', () => {
  beforeEach(() => {
    sessionState = {
      id: 'decision-session-1',
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'open',
      packet: { summary: 'blocked twist' },
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

  it('creates a session, appends messages, and saves a resolution', async () => {
    prisma.decisionSessionRecord.create.mockImplementation(async ({ data }) => {
      sessionState = {
        ...sessionState,
        ...data,
        id: 'decision-session-1',
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      };

      return sessionState;
    });
    prisma.decisionResolutionRecord.upsert.mockImplementation(async ({ create }) => {
      sessionState.resolution = {
        sessionId: create.sessionId,
        resolutionType: create.resolutionType
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
    prisma.decisionSessionRecord.findUnique.mockImplementation(async () => ({
      ...sessionState,
      messages: [...sessionState.messages],
      resolution: sessionState.resolution
    }));

    let releaseMessageCreate!: () => void;
    const messageCreateGate = new Promise<void>((resolve) => {
      releaseMessageCreate = resolve;
    });
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
      packet: { summary: 'blocked twist' }
    });

    const appendPromise = repository.appendMessage({
      sessionId: session.id,
      role: 'human',
      content: 'Give me a safer alternative'
    });

    await repository.saveResolution({
      sessionId: session.id,
      resolutionType: 'accept_alternative',
      decisionSummary: 'Delay the reveal by one chapter',
      storyFactsToApply: ['villain identity remains hidden'],
      chapterPlanAdjustments: ['shift reveal to chapter 9'],
      volumeImpact: null,
      nextAction: 'replan_chapter'
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
      data: { status: 'resolved' }
    });

    const detail = await repository.getSessionDetail(session.id);
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.resolution?.resolutionType).toBe('accept_alternative');
    expect(detail?.status).toBe('resolved');
    expect(sessionState.status).toBe('resolved');
  });
});
