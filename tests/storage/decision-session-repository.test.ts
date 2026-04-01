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

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('DecisionSessionRepository', () => {
  beforeEach(() => {
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
    prisma.decisionSessionRecord.create.mockResolvedValue({
      id: 'decision-session-1',
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'open',
      packet: { summary: 'blocked twist' }
    });
    prisma.decisionMessageRecord.create.mockResolvedValue({ id: 'message-1' });
    prisma.decisionResolutionRecord.upsert.mockResolvedValue({ sessionId: 'decision-session-1' });
    prisma.decisionSessionRecord.update.mockResolvedValue({
      id: 'decision-session-1',
      status: 'resolved'
    });
    prisma.decisionSessionRecord.findUnique
      .mockResolvedValueOnce({
        status: 'open'
      })
      .mockResolvedValue({
        id: 'decision-session-1',
        status: 'resolved',
        messages: [{ id: 'message-1', role: 'human', content: 'Give me a safer alternative' }],
        resolution: {
          sessionId: 'decision-session-1',
          resolutionType: 'accept_alternative'
        }
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

    await repository.appendMessage({
      sessionId: session.id,
      role: 'human',
      content: 'Give me a safer alternative'
    });

    expect(prisma.decisionSessionRecord.update).toHaveBeenCalledWith({
      where: { id: session.id },
      data: { status: 'open' }
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

    const detail = await repository.getSessionDetail(session.id);
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.resolution?.resolutionType).toBe('accept_alternative');
    expect(detail?.status).toBe('resolved');
  });
});
