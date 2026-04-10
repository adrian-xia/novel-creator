import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAgentRunner = vi.hoisted(() => vi.fn());
const invokeOpenAICompatibleModel = vi.hoisted(() => vi.fn());
const findEnabledByProviderModel = vi.hoisted(() => vi.fn());

vi.mock('../../packages/agent-runtime/src/agent-runner', () => ({
  createAgentRunner
}));

vi.mock('../../packages/llm-gateway/src/openai-compatible-client', () => ({
  invokeOpenAICompatibleModel
}));

vi.mock('../../packages/storage/src/repositories/decision-session-repository', () => ({
  DecisionSessionRepository: class {}
}));

vi.mock('../../packages/storage/src/repositories/prompt-repository', () => ({
  PromptRepository: class {}
}));

vi.mock('../../packages/storage/src/repositories/project-repository', () => ({
  ProjectRepository: class {}
}));

vi.mock('../../packages/storage/src/repositories/story-state-repository', () => ({
  StoryStateRepository: class {
    saveAgentRun = vi.fn();
  }
}));

vi.mock('../../packages/storage/src/repositories/provider-capacity-repository', () => ({
  ProviderCapacityRepository: class {
    findEnabledByProviderModel = findEnabledByProviderModel;
  }
}));

describe('createProductionWorkflowDeps', () => {
  beforeEach(() => {
    createAgentRunner.mockReset();
    invokeOpenAICompatibleModel.mockReset();
    findEnabledByProviderModel.mockReset();
    delete process.env.OPENAI_PRIMARY;
  });

  it('builds production deps with an agent runner and default outline-volume model settings', async () => {
    let capturedDeps: Record<string, unknown> | undefined;
    const runner = { run: vi.fn() };
    createAgentRunner.mockImplementation((deps) => {
      capturedDeps = deps as Record<string, unknown>;
      return runner;
    });

    const { createProductionWorkflowDeps } = await import(
      '../../packages/workflows/src/production-deps'
    );
    const deps = createProductionWorkflowDeps();

    expect(deps.defaultProvider).toBe('openai');
    expect(deps.defaultModel).toBe('gpt-5.4');
    expect(deps.agentRunner).toBe(runner);
    expect(deps.decisionSessionRepository).toBeInstanceOf(Object);
    expect(typeof capturedDeps?.acquire).toBe('function');
    expect(typeof capturedDeps?.invokeModel).toBe('function');
    expect(typeof capturedDeps?.saveAgentRun).toBe('function');
  });

  it('acquires provider capacity and resolves api keys for model invocation', async () => {
    let capturedDeps: Record<string, unknown> | undefined;
    createAgentRunner.mockImplementation((deps) => {
      capturedDeps = deps as Record<string, unknown>;
      return { run: vi.fn() };
    });
    findEnabledByProviderModel.mockResolvedValue([
      {
        id: 'capacity-1',
        provider: 'openai',
        model: 'gpt-5.4',
        keyName: 'primary',
        baseUrl: 'https://api.openai.com/v1',
        apiKeySecretRef: 'vault://openai/primary',
        protocolMode: 'responses',
        maxConcurrentRequests: 8,
        requestsPerMinute: 120,
        tokensPerMinute: 240000,
        dailyBudget: '50.00',
        enabled: true,
        priority: 1
      }
    ]);
    invokeOpenAICompatibleModel.mockResolvedValue({
      rawOutput: '{"title":"卷一"}',
      parsedOutput: { title: '卷一' },
      tokenUsage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
    });
    process.env.OPENAI_PRIMARY = 'secret-key';

    const { createProductionWorkflowDeps } = await import(
      '../../packages/workflows/src/production-deps'
    );
    createProductionWorkflowDeps();

    const acquire = capturedDeps?.acquire as (input: {
      provider: string;
      model: string;
    }) => Promise<Record<string, unknown>>;
    const invokeModel = capturedDeps?.invokeModel as (input: {
      prompt: string;
      provider: string;
      model: string;
      baseUrl: string;
      apiKeySecretRef: string;
      protocolMode: 'auto' | 'responses' | 'chat_completions';
    }) => Promise<unknown>;

    await expect(acquire({ provider: 'openai', model: 'gpt-5.4' })).resolves.toMatchObject({
      keyId: 'capacity-1',
      baseUrl: 'https://api.openai.com/v1',
      apiKeySecretRef: 'vault://openai/primary'
    });

    await invokeModel({
      prompt: 'rendered prompt',
      provider: 'openai',
      model: 'gpt-5.4',
      baseUrl: 'https://api.openai.com/v1',
      apiKeySecretRef: 'vault://openai/primary',
      protocolMode: 'responses'
    });

    expect(invokeOpenAICompatibleModel).toHaveBeenCalledWith({
      prompt: 'rendered prompt',
      provider: 'openai',
      model: 'gpt-5.4',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'secret-key',
      protocolMode: 'responses'
    });
  });
});
