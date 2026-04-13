import type { AgentRun } from '@novel-creator/domain';
import { createAgentRunner } from '../../agent-runtime/src/agent-runner';
import { renderPrompt as renderPromptTemplate } from '../../agent-runtime/src/prompt-renderer';
import { CapacityService, type CapacityKey } from '../../llm-gateway/src/capacity-service';
import { invokeOpenAICompatibleModel } from '../../llm-gateway/src/openai-compatible-client';
import { DecisionRecoveryRepository } from '../../storage/src/repositories/decision-recovery-repository';
import { DecisionSessionRepository } from '../../storage/src/repositories/decision-session-repository';
import { ProviderCapacityRepository } from '../../storage/src/repositories/provider-capacity-repository';
import { PromptRepository } from '../../storage/src/repositories/prompt-repository';
import { ProjectRepository } from '../../storage/src/repositories/project-repository';
import { StoryStateRepository } from '../../storage/src/repositories/story-state-repository';
import { WorkflowRunRepository } from '../../storage/src/repositories/workflow-run-repository';
import type { WorkflowDeps } from './workflow-deps';

const DEFAULT_PROVIDER = 'openai';
const DEFAULT_MODEL = 'gpt-5.4';

function toCapacityKeys(records: Awaited<ReturnType<ProviderCapacityRepository['findEnabledByProviderModel']>>): CapacityKey[] {
  return records.map((record) => ({
    ...record,
    currentLeases: 0
  }));
}

function resolveSecretEnvName(secretRef: string): string {
  if (secretRef.startsWith('env://')) {
    return secretRef.slice('env://'.length);
  }

  if (secretRef.startsWith('vault://')) {
    return secretRef
      .slice('vault://'.length)
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  return secretRef;
}

function resolveApiKey(secretRef: string): string {
  const envName = resolveSecretEnvName(secretRef);
  const apiKey = process.env[envName];

  if (!apiKey) {
    throw new Error(`API key not configured for ${secretRef}`);
  }

  return apiKey;
}

function renderPrompt(input: Record<string, unknown>): string {
  const systemPrompt = typeof input.systemPrompt === 'string' ? input.systemPrompt : null;
  const taskTemplate = typeof input.taskTemplate === 'string' ? input.taskTemplate : null;
  const variables =
    input.variables && typeof input.variables === 'object' && !Array.isArray(input.variables)
      ? Object.fromEntries(
          Object.entries(input.variables as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : JSON.stringify(value)
          ])
        )
      : null;

  if (systemPrompt && taskTemplate && variables) {
    return `${systemPrompt}\n\n${renderPromptTemplate(taskTemplate, variables)}`;
  }

  return JSON.stringify(input, null, 2);
}

export function createProductionWorkflowDeps(): WorkflowDeps {
  const providerCapacityRepository = new ProviderCapacityRepository();
  return {
    promptRepository: new PromptRepository(),
    projectRepository: new ProjectRepository(),
    storyStateRepository: new StoryStateRepository(),
    decisionSessionRepository: new DecisionSessionRepository(),
    decisionRecoveryRepository: new DecisionRecoveryRepository(),
    workflowRunRepository: new WorkflowRunRepository(),
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
    agentRunner: (() => {
      const storyStateRepository = new StoryStateRepository();
      const capacityServices = new Map<string, Promise<CapacityService>>();
      const leasedServices = new Map<string, CapacityService>();

      const getCapacityService = async (provider: string, model: string) => {
        const cacheKey = `${provider}:${model}`;
        const existing = capacityServices.get(cacheKey);

        if (existing) {
          return existing;
        }

        const next = providerCapacityRepository
          .findEnabledByProviderModel(provider, model)
          .then((records) => new CapacityService(toCapacityKeys(records)));
        capacityServices.set(cacheKey, next);
        return next;
      };

      return createAgentRunner({
        acquire: async (request) => {
          const service = await getCapacityService(request.provider, request.model);
          const lease = await service.acquire(request);
          leasedServices.set(lease.leaseId, service);
          return lease;
        },
        release: async (lease) => {
          const service = leasedServices.get(lease.leaseId);

          if (!service) {
            throw new Error(`Lease service not found for ${lease.leaseId}`);
          }

          leasedServices.delete(lease.leaseId);
          await service.release(lease);
        },
        renderPrompt,
        invokeModel: async (input) =>
          invokeOpenAICompatibleModel({
            prompt: input.prompt,
            provider: input.provider,
            model: input.model,
            baseUrl: input.baseUrl,
            apiKey: resolveApiKey(input.apiKeySecretRef),
            protocolMode: input.protocolMode
          }),
        saveAgentRun: (run) => storyStateRepository.saveAgentRun(run as AgentRun)
      });
    })()
  };
}
