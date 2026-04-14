import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptConfig } from '../../packages/domain/src/prompt-config';

const createPromptRecord = vi.fn();
const findPromptRecord = vi.fn();
const findPromptRecords = vi.fn();
const upsertPromptRecord = vi.fn();

vi.mock('../../packages/storage/src/client', () => ({
  prisma: {
    promptConfig: {
      create: createPromptRecord,
      findFirst: findPromptRecord,
      findMany: findPromptRecords,
      upsert: upsertPromptRecord
    }
  }
}));

describe('prompt repository contracts', () => {
  beforeEach(() => {
    createPromptRecord.mockReset();
    findPromptRecord.mockReset();
    findPromptRecords.mockReset();
    upsertPromptRecord.mockReset();
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

  it('lists prompt configs ordered by agent name and version', async () => {
    const { PromptRepository } = await import(
      '../../packages/storage/src/repositories/prompt-repository'
    );
    const promptConfigs: PromptConfig[] = [
      {
        id: 'prompt-2',
        agentName: 'chapter-plan-agent',
        version: 2,
        systemPrompt: 'You are the chapter planner.',
        taskTemplate: 'Plan the next chapter.',
        outputSchema: { type: 'object' },
        enabled: true,
        reviewRubric: undefined,
        lastTestedModel: 'deepseek-r1'
      },
      {
        id: 'prompt-1',
        agentName: 'outline-agent',
        version: 1,
        systemPrompt: 'You are the outline planner.',
        taskTemplate: 'Generate an outline.',
        outputSchema: { type: 'object' },
        enabled: true,
        reviewRubric: undefined,
        lastTestedModel: 'deepseek-r1'
      }
    ];

    findPromptRecords.mockResolvedValue(promptConfigs);

    const repository = new PromptRepository();

    await expect(repository.listAll()).resolves.toEqual(promptConfigs);
    expect(findPromptRecords).toHaveBeenCalledWith({
      orderBy: [{ agentName: 'asc' }, { version: 'desc' }, { createdAt: 'desc' }]
    });
  });

  it('upserts a prompt config by agent name and version', async () => {
    const { PromptRepository } = await import(
      '../../packages/storage/src/repositories/prompt-repository'
    );
    const promptConfig: PromptConfig = {
      id: 'prompt-3',
      agentName: 'review-agent',
      version: 1,
      systemPrompt: 'You are the review agent.',
      taskTemplate: 'Review the chapter draft.',
      outputSchema: { type: 'object' },
      reviewRubric: 'Check logic, pacing, and continuity.',
      enabled: true,
      lastTestedModel: 'deepseek-r1'
    };

    upsertPromptRecord.mockResolvedValue(promptConfig);

    const repository = new PromptRepository();

    await expect(repository.upsert(promptConfig)).resolves.toEqual(promptConfig);
    expect(upsertPromptRecord).toHaveBeenCalledWith({
      where: {
        agentName_version: {
          agentName: 'review-agent',
          version: 1
        }
      },
      create: promptConfig,
      update: {
        systemPrompt: 'You are the review agent.',
        taskTemplate: 'Review the chapter draft.',
        outputSchema: { type: 'object' },
        reviewRubric: 'Check logic, pacing, and continuity.',
        enabled: true,
        lastTestedModel: 'deepseek-r1'
      }
    });
  });
});
