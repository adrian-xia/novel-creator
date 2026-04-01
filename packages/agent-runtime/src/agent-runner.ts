interface CapacityLease {
  leaseId: string;
  provider: string;
  model: string;
  apiKeyId: string;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface AgentRunResult {
  rawOutput: string;
  parsedOutput: Record<string, unknown> | null;
  tokenUsage: TokenUsage;
}

interface AgentRunnerDeps {
  acquire: () => Promise<CapacityLease>;
  release: (leaseId: string) => Promise<void>;
  renderPrompt: (input: Record<string, unknown>) => string;
  invokeModel: (input: {
    prompt: string;
    provider: string;
    model: string;
  }) => Promise<AgentRunResult>;
  saveAgentRun: (run: Record<string, unknown>) => Promise<void>;
}

interface AgentRunnerInput {
  agentType: string;
  promptConfigVersion: number;
  projectId: string;
  chapterNumber: number | null;
  inputSnapshot: Record<string, unknown>;
}

export function createAgentRunner(deps: AgentRunnerDeps) {
  return {
    async run(input: AgentRunnerInput) {
      const lease = await deps.acquire();

      try {
        const prompt = deps.renderPrompt(input.inputSnapshot);
        const result = await deps.invokeModel({
          prompt,
          provider: lease.provider,
          model: lease.model
        });

        await deps.saveAgentRun({
          projectId: input.projectId,
          chapterNumber: input.chapterNumber,
          agentType: input.agentType,
          promptConfigVersion: input.promptConfigVersion,
          provider: lease.provider,
          model: lease.model,
          apiKeyId: lease.apiKeyId,
          leaseId: lease.leaseId,
          inputSnapshot: input.inputSnapshot,
          rawOutput: result.rawOutput,
          parsedOutput: result.parsedOutput,
          status: 'succeeded',
          tokenUsage: result.tokenUsage,
          errorMessage: null
        });

        await deps.release(lease.leaseId);
        return result;
      } catch (error) {
        await deps.saveAgentRun({
          projectId: input.projectId,
          chapterNumber: input.chapterNumber,
          agentType: input.agentType,
          promptConfigVersion: input.promptConfigVersion,
          provider: lease.provider,
          model: lease.model,
          apiKeyId: lease.apiKeyId,
          leaseId: lease.leaseId,
          inputSnapshot: input.inputSnapshot,
          rawOutput: '',
          parsedOutput: null,
          status: 'failed',
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          errorMessage: error instanceof Error ? error.message : 'unknown error'
        });

        await deps.release(lease.leaseId);
        throw error;
      }
    }
  };
}
