import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDecisionQueueMock = vi.fn();
const getSessionDetailMock = vi.fn();
const appendMessageMock = vi.fn();
const confirmHumanGateMock = vi.fn();
const cancelSessionMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/project-repository', () => ({
  ProjectRepository: class {
    getDecisionQueue = getDecisionQueueMock;
  }
}));

vi.mock('../../packages/storage/src/repositories/decision-session-repository', () => ({
  DecisionSessionRepository: class {
    getSessionDetail = getSessionDetailMock;
    appendMessage = appendMessageMock;
    confirmHumanGate = confirmHumanGateMock;
    cancelSession = cancelSessionMock;
  }
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('decision session routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns a decision queue response', async () => {
    getDecisionQueueMock.mockResolvedValue([
      {
        id: 'session-123',
        projectId: 'project-1',
        chapterNumber: 8,
        status: 'awaiting_human_input',
        triggerReason: 'Continuity conflict detected in chapter review.',
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        gateType: 'outline_confirmation',
        recommendedOptionId: 'accept-outline',
        selectedOptionId: null,
        project: {
          id: 'project-1',
          title: 'Project One'
        }
      }
    ]);

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/decision-sessions'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          sessionId: 'session-123',
          projectId: 'project-1',
          chapterNumber: 8,
          status: 'awaiting_human_input',
          triggerReason: 'Continuity conflict detected in chapter review.',
          updatedAt: '2026-04-02T00:00:00.000Z',
          gateType: 'outline_confirmation',
          recommendedOptionId: 'accept-outline',
          selectedOptionId: null
        }
      ]
    });
    expect(getDecisionQueueMock).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('returns decision session detail with real route fields', async () => {
    getSessionDetailMock.mockResolvedValue({
      id: 'session-123',
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'awaiting_resolution_confirmation',
      triggerReason: 'Continuity conflict detected in chapter review.',
      updatedAt: new Date('2026-04-02T00:00:00.000Z'),
      packet: {
        reviewOutcomeId: 'review-456',
        summary: 'Two scenes disagree on who knows the villain identity.'
      },
      messages: [
        {
          sessionId: 'session-123',
          sequence: 1,
          role: 'system',
          messageType: 'system',
          content: 'Decision session opened for chapter 8 continuity review.',
          createdAt: new Date('2026-04-02T00:00:00.000Z')
        }
      ],
      resolution: null,
      currentDraftResolution: {
        resolutionType: 'accept_alternative'
      }
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/decision-sessions/session-123'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessionId: 'session-123',
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'awaiting_resolution_confirmation',
      triggerReason: 'Continuity conflict detected in chapter review.',
      updatedAt: '2026-04-02T00:00:00.000Z',
      gateType: null,
      options: [],
      recommendedOptionId: null,
      selectedOptionId: null,
      humanNotes: null,
      packet: {
        reviewOutcomeId: 'review-456',
        summary: 'Two scenes disagree on who knows the villain identity.'
      },
      messages: [
        {
          sessionId: 'session-123',
          sequence: 1,
          role: 'system',
          messageType: 'system',
          content: 'Decision session opened for chapter 8 continuity review.',
          createdAt: '2026-04-02T00:00:00.000Z'
        }
      ],
      resolution: null,
      currentDraftResolution: {
        resolutionType: 'accept_alternative'
      },
      confirmation: {
        required: true,
        requestType: 'confirm_resolution'
      }
    });
    expect(getSessionDetailMock).toHaveBeenCalledWith('session-123');
    await app.close();
  });

  it('returns human gate detail with recommendation metadata', async () => {
    getSessionDetailMock.mockResolvedValue({
      id: 'session-gate-1',
      projectId: 'project-1',
      chapterNumber: null,
      status: 'open',
      triggerReason: 'outline_ready_for_confirmation',
      updatedAt: new Date('2026-04-03T00:00:00.000Z'),
      gateType: 'outline_confirmation',
      options: [
        {
          optionId: 'accept-outline',
          title: '直接采用',
          strategy: 'recommended',
          rationale: '结构完整，可直接推进。',
          impactSummary: '进入卷规划。',
          patch: { action: 'accept' }
        }
      ],
      recommendedOptionId: 'accept-outline',
      selectedOptionId: null,
      humanNotes: null,
      packet: {
        outline: { title: '卷一' }
      },
      messages: [],
      resolution: null,
      currentDraftResolution: null
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/decision-sessions/session-gate-1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      sessionId: 'session-gate-1',
      chapterNumber: null,
      gateType: 'outline_confirmation',
      options: [
        {
          optionId: 'accept-outline',
          title: '直接采用'
        }
      ],
      recommendedOptionId: 'accept-outline',
      selectedOptionId: null,
      humanNotes: null
    });
    await app.close();
  });

  it('rejects an invalid decision message payload', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/messages',
      payload: {
        role: 'human',
        messageType: 'human'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid decision message payload'
    });
    await app.close();
  });

  it('rejects non-human authored message payloads', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/messages',
      payload: {
        role: 'assistant',
        messageType: 'assistant',
        content: 'Fabricated assistant reply'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid decision message payload'
    });
    await app.close();
  });

  it('returns appended message and assistant work route shape for a valid message payload', async () => {
    appendMessageMock.mockResolvedValue({
      sessionId: 'session-123',
      sequence: 4,
      role: 'human',
      messageType: 'human',
      content: 'Keep the reveal later and preserve the mentor scene.',
      createdAt: new Date('2026-04-02T00:03:00.000Z')
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/messages',
      payload: {
        content: 'Keep the reveal later and preserve the mentor scene.'
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      sessionId: 'session-123',
      status: 'awaiting_assistant_reply',
      appendedMessage: {
        sessionId: 'session-123',
        sequence: 4,
        role: 'human',
        messageType: 'human',
        content: 'Keep the reveal later and preserve the mentor scene.',
        createdAt: '2026-04-02T00:03:00.000Z'
      },
      assistantWork: {
        flowName: 'decision-session-flow',
        status: 'queued',
        steps: [
          'append-human-message',
          'load-decision-context',
          'assemble-decision-conversation-context',
          'run-decision-assistant',
          'persist-assistant-message',
          'generate-resolution-draft',
          'persist-resolution',
          'apply-resolution',
          'invalidate-plans-in-window',
          'enqueue-replan-window'
        ]
      }
    });
    expect(appendMessageMock).toHaveBeenCalledWith({
      sessionId: 'session-123',
      sequence: 0,
      role: 'human',
      messageType: 'human',
      content: 'Keep the reveal later and preserve the mentor scene.'
    });
    await app.close();
  });

  it('confirms a human gate with the selected option and free-text notes', async () => {
    confirmHumanGateMock.mockResolvedValue({
      id: 'session-123',
      status: 'resolved',
      selectedOptionId: 'accept-outline',
      humanNotes: '保留主线，先继续。'
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/confirm',
      payload: {
        selectedOptionId: 'accept-outline',
        humanNotes: '保留主线，先继续。'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessionId: 'session-123',
      status: 'resolved',
      selectedOptionId: 'accept-outline',
      humanNotes: '保留主线，先继续。'
    });
    expect(confirmHumanGateMock).toHaveBeenCalledWith('session-123', {
      selectedOptionId: 'accept-outline',
      humanNotes: '保留主线，先继续。'
    });
    await app.close();
  });

  it('rejects an invalid human gate confirmation payload', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/confirm',
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid gate confirmation payload'
    });
    expect(confirmHumanGateMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('cancels a human gate session', async () => {
    cancelSessionMock.mockResolvedValue({
      id: 'session-123',
      status: 'cancelled'
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/cancel'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessionId: 'session-123',
      status: 'cancelled'
    });
    expect(cancelSessionMock).toHaveBeenCalledWith('session-123');
    await app.close();
  });

  it('returns a 400 when cancelling a human gate fails', async () => {
    cancelSessionMock.mockRejectedValue(new Error('Session already resolved'));

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/cancel'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Session already resolved'
    });
    await app.close();
  });
});
