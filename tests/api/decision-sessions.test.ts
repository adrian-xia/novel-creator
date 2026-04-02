import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getDecisionQueueMock = vi.fn();
const getSessionDetailMock = vi.fn();
const appendMessageMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/project-repository', () => ({
  ProjectRepository: class {
    getDecisionQueue = getDecisionQueueMock;
  }
}));

vi.mock('../../packages/storage/src/repositories/decision-session-repository', () => ({
  DecisionSessionRepository: class {
    getSessionDetail = getSessionDetailMock;
    appendMessage = appendMessageMock;
  }
}));

import { buildApp } from '../../apps/api/src/app';

describe('decision session routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await buildApp().close();
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
        project: {
          id: 'project-1',
          title: 'Project One'
        }
      }
    ]);

    const app = buildApp();
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
          updatedAt: '2026-04-02T00:00:00.000Z'
        }
      ]
    });
    expect(getDecisionQueueMock).toHaveBeenCalledTimes(1);
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

    const app = buildApp();
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
  });

  it('rejects an invalid decision message payload', async () => {
    const app = buildApp();
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
  });

  it('rejects non-human authored message payloads', async () => {
    const app = buildApp();
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

    const app = buildApp();
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
        status: 'queued',
        taskType: 'generate_decision_reply'
      }
    });
    expect(appendMessageMock).toHaveBeenCalledWith({
      sessionId: 'session-123',
      sequence: 0,
      role: 'human',
      messageType: 'human',
      content: 'Keep the reveal later and preserve the mentor scene.'
    });
  });
});
