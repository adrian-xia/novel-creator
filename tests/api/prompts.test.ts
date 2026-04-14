import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

const createPromptRecordMock = vi.fn();
const listPromptRecordsMock = vi.fn();
const upsertPromptRecordMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/prompt-repository', () => ({
  PromptRepository: class {
    create = createPromptRecordMock;
    listAll = listPromptRecordsMock;
    upsert = upsertPromptRecordMock;
  }
}));

describe('prompts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists prompt configs', async () => {
    listPromptRecordsMock.mockResolvedValue([
      {
        id: 'prompt-1',
        agentName: 'outline-agent',
        version: 1,
        systemPrompt: 'You are the outline planner.',
        taskTemplate: 'Generate a 3-act outline.',
        outputSchema: { type: 'object' },
        reviewRubric: null,
        enabled: true,
        lastTestedModel: 'deepseek-r1'
      }
    ]);

    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/prompts'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          id: 'prompt-1',
          agentName: 'outline-agent',
          version: 1,
          systemPrompt: 'You are the outline planner.',
          taskTemplate: 'Generate a 3-act outline.',
          outputSchema: { type: 'object' },
          reviewRubric: null,
          enabled: true,
          lastTestedModel: 'deepseek-r1'
        }
      ]
    });
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

  it('bootstraps the default prompt configs', async () => {
    upsertPromptRecordMock
      .mockResolvedValueOnce({
        id: 'prompt-outline',
        agentName: 'outline-agent',
        version: 1,
        systemPrompt: 'Outline seed',
        taskTemplate: 'Outline template',
        outputSchema: { type: 'object' },
        reviewRubric: null,
        enabled: true,
        lastTestedModel: 'deepseek-r1'
      })
      .mockResolvedValueOnce({
        id: 'prompt-volume',
        agentName: 'volume-agent',
        version: 1,
        systemPrompt: 'Volume seed',
        taskTemplate: 'Volume template',
        outputSchema: { type: 'object' },
        reviewRubric: null,
        enabled: true,
        lastTestedModel: 'deepseek-r1'
      })
      .mockResolvedValue({
        id: 'prompt-generic',
        agentName: 'other-agent',
        version: 1,
        systemPrompt: 'Prompt seed',
        taskTemplate: 'Prompt template',
        outputSchema: { type: 'object' },
        reviewRubric: null,
        enabled: true,
        lastTestedModel: 'deepseek-r1'
      });

    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/prompts/bootstrap'
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();

    expect(body.count).toBe(6);
    expect(body.items).toHaveLength(6);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        agentName: 'outline-agent',
        version: 1
      })
    );
    expect(upsertPromptRecordMock).toHaveBeenCalledTimes(6);
  });
});
