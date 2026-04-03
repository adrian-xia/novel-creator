interface AcquireRequest {
  provider: string;
  model: string;
}

interface CapacityLease {
  keyId: string;
  leaseId: string;
  baseUrl: string;
  apiKeySecretRef: string;
  protocolMode: 'auto' | 'responses' | 'chat_completions';
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
  acquire: (request: AcquireRequest) => Promise<CapacityLease>;
  release: (lease: CapacityLease) => Promise<void>;
  renderPrompt: (input: Record<string, unknown>) => string;
  invokeModel: (input: {
    prompt: string;
    provider: string;
    model: string;
    baseUrl: string;
    apiKeySecretRef: string;
    protocolMode: 'auto' | 'responses' | 'chat_completions';
  }) => Promise<AgentRunResult>;
  saveAgentRun: (run: Record<string, unknown>) => Promise<void>;
}

interface AgentRunnerInput {
  agentType: string;
  promptConfigVersion: number;
  projectId: string;
  chapterNumber: number | null;
  provider: string;
  model: string;
  inputSnapshot: Record<string, unknown>;
}

export function createAgentRunner(deps: AgentRunnerDeps) {
  return {
    async run(input: AgentRunnerInput) {
      const lease = await deps.acquire({
        provider: input.provider,
        model: input.model
      });
      let phase: 'invoking-model' | 'recording-run' = 'invoking-model';

      try {
        const prompt = deps.renderPrompt(input.inputSnapshot);
        const result = await deps.invokeModel({
          prompt,
          provider: input.provider,
          model: input.model,
          baseUrl: lease.baseUrl,
          apiKeySecretRef: lease.apiKeySecretRef,
          protocolMode: lease.protocolMode
        });

        phase = 'recording-run';
        await deps.saveAgentRun({
          projectId: input.projectId,
          chapterNumber: input.chapterNumber,
          agentType: input.agentType,
          promptConfigVersion: input.promptConfigVersion,
          provider: input.provider,
          model: input.model,
          apiKeyId: lease.keyId,
          leaseId: lease.leaseId,
          inputSnapshot: input.inputSnapshot,
          rawOutput: result.rawOutput,
          parsedOutput: result.parsedOutput,
          status: 'succeeded',
          tokenUsage: result.tokenUsage,
          errorMessage: null
        });

        return result;
      } catch (error) {
        if (phase === 'invoking-model') {
          await deps.saveAgentRun({
            projectId: input.projectId,
            chapterNumber: input.chapterNumber,
            agentType: input.agentType,
            promptConfigVersion: input.promptConfigVersion,
            provider: input.provider,
            model: input.model,
            apiKeyId: lease.keyId,
            leaseId: lease.leaseId,
            inputSnapshot: input.inputSnapshot,
            rawOutput: '',
            parsedOutput: null,
            status: 'failed',
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            errorMessage: error instanceof Error ? error.message : 'unknown error'
          });
        }

        throw error;
      } finally {
        await deps.release(lease);
      }
    }
  };
}
