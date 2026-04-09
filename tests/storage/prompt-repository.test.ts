import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptConfig } from '../../packages/domain/src/prompt-config';

const createPromptRecord = vi.fn();
const findPromptRecord = vi.fn();

vi.mock('../../packages/storage/src/client', () => ({
  prisma: {
    promptConfig: {
      create: createPromptRecord,
      findFirst: findPromptRecord
    }
  }
}));

describe('prompt repository contracts', () => {
  beforeEach(() => {
    createPromptRecord.mockReset();
    findPromptRecord.mockReset();
  });

  it('persists a prompt config with a structured output schema', async () => {
    const { PromptRepository } = await import(
      '../../packages/storage/src/repositories/prompt-repository'
    );
    const promptConfig: PromptConfig = {
      id: 'prompt-1',
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
      reviewRubric: 'Check pacing and conflict escalation.',
      enabled: true,
      lastTestedModel: 'gpt-5.4'
    };

    createPromptRecord.mockResolvedValue(promptConfig);

    await expect(new PromptRepository().create(promptConfig)).resolves.toEqual(promptConfig);
    expect(createPromptRecord).toHaveBeenCalledWith({
      data: promptConfig
    });
  });

  it('loads the latest enabled prompt config by agent name', async () => {
    const { PromptRepository } = await import(
      '../../packages/storage/src/repositories/prompt-repository'
    );
    const promptConfig: PromptConfig = {
      id: 'prompt-2',
      agentName: 'outline-agent',
      version: 3,
      systemPrompt: 'You are the outline planner.',
      taskTemplate: 'Generate a serialized outline.',
      outputSchema: {
        type: 'object'
      },
      reviewRubric: 'Check long-range payoff density.',
      enabled: true,
      lastTestedModel: 'gpt-5.4'
    };

    findPromptRecord.mockResolvedValue(promptConfig);

    const repository = new PromptRepository();
    await expect(repository.findLatestEnabledByAgentName('outline-agent')).resolves.toEqual(
      promptConfig
    );
    expect(findPromptRecord).toHaveBeenCalledWith({
      where: { agentName: 'outline-agent', enabled: true },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
    });
  });
});
