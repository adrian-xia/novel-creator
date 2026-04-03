import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

const createPromptRecordMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/prompt-repository', () => ({
  PromptRepository: class {
    create = createPromptRecordMock;
  }
}));

describe('prompts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a prompt config', async () => {
    createPromptRecordMock.mockResolvedValue({
      id: 'prompt-persisted',
      agentName: 'outline-agent',
      version: 1,
      systemPrompt: 'You are the outline planner.',
      taskTemplate: 'Generate a 3-act outline.',
      outputSchema: {
        type: 'object',
        properties: {
          acts: {
            type: 'array'
          }
        }
      },
      reviewRubric: 'Check pacing and escalation.',
      enabled: true,
      lastTestedModel: 'gpt-5.4'
    });

    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/prompts',
      payload: {
        agentName: 'outline-agent',
        version: 1,
        systemPrompt: 'You are the outline planner.',
        taskTemplate: 'Generate a 3-act outline.',
        outputSchema: {
          type: 'object',
          properties: {
            acts: {
              type: 'array'
            }
          }
        },
        reviewRubric: 'Check pacing and escalation.',
        enabled: true,
        lastTestedModel: 'gpt-5.4'
      }
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body).toEqual({
      id: 'prompt-persisted',
      agentName: 'outline-agent',
      version: 1,
      systemPrompt: 'You are the outline planner.',
      taskTemplate: 'Generate a 3-act outline.',
      outputSchema: {
        type: 'object',
        properties: {
          acts: {
            type: 'array'
          }
        }
      },
      reviewRubric: 'Check pacing and escalation.',
      enabled: true,
      lastTestedModel: 'gpt-5.4'
    });
    expect(createPromptRecordMock).toHaveBeenCalledTimes(1);
    expect(createPromptRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: 'outline-agent',
        version: 1,
        systemPrompt: 'You are the outline planner.',
        taskTemplate: 'Generate a 3-act outline.',
        outputSchema: {
          type: 'object',
          properties: {
            acts: {
              type: 'array'
            }
          }
        },
        reviewRubric: 'Check pacing and escalation.',
        enabled: true,
        lastTestedModel: 'gpt-5.4',
        id: expect.any(String)
      })
    );
  });

  it('rejects an invalid prompt payload', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/prompts',
      payload: {
        agentName: 'outline-agent',
        version: '1',
        systemPrompt: 'You are the outline planner.',
        taskTemplate: 'Generate a 3-act outline.',
        outputSchema: {
          type: 'object'
        },
        enabled: true
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid prompt payload'
    });
  });
});
