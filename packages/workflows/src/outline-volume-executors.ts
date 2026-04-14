import type { NovelProject, PromptConfig } from '@novel-creator/domain';
import type { DecisionSessionRepository } from '../../storage/src/repositories/decision-session-repository';
import type { PromptRepository } from '../../storage/src/repositories/prompt-repository';
import type { ProjectRepository } from '../../storage/src/repositories/project-repository';
import type { StoryStateRepository } from '../../storage/src/repositories/story-state-repository';
import type { OutlineFlowContext } from './generate-outline-flow';
import type { VolumeFlowContext } from './generate-volume-flow';
import { requestHumanGate } from './human-gate';
import { parseOutlineOutput, parseVolumeOutput } from './outline-volume-parsers';
import { parseStructuredJsonOutput } from './structured-output';
import type { WorkflowAgentRunner } from './workflow-deps';

export interface OutlineVolumeWorkflowDeps {
  projectRepository: Pick<ProjectRepository, 'findById' | 'findByIdWithStoryState'>;
  promptRepository: Pick<PromptRepository, 'findLatestEnabledByAgentName'>;
  storyStateRepository: Pick<StoryStateRepository, 'saveOutline' | 'saveVolumePlans'>;
  agentRunner?: WorkflowAgentRunner;
  defaultProvider?: string;
  defaultModel?: string;
}

type OutlineVolumeHumanGateReaderDeps = {
  decisionSessionRepository: Pick<DecisionSessionRepository, 'listSessions'>;
};

type OutlineProjectInput = Pick<NovelProject, 'id' | 'premise' | 'genre'>;
type OutlineProjectWithStoryState = OutlineProjectInput & {
  storyState?: {
    storyBible: string | null;
  } | null;
};
type VolumeProjectInput = Pick<NovelProject, 'id' | 'premise' | 'genre'> & {
  storyState?: {
    outline: Record<string, unknown> | null;
    storyBible: string | null;
  } | null;
};

type PromptInput = Pick<
  PromptConfig,
  'id' | 'agentName' | 'version' | 'systemPrompt' | 'taskTemplate' | 'outputSchema' | 'enabled'
>;

function buildOutlineGateOptions() {
  return [
    {
      optionId: 'accept-outline',
      title: 'Use this outline',
      strategy: 'recommended',
      rationale: 'The generated outline is persisted and ready for confirmation.',
      impactSummary: 'Approve to continue into volume planning with the saved outline.',
      patch: { action: 'accept_outline' }
    },
    {
      optionId: 'revise-outline',
      title: 'Revise outline',
      strategy: 'alternative',
      rationale: 'Pause here if the outline needs human edits or a refreshed outline pass.',
      impactSummary: 'Keeps the saved outline available for review before any volume plans are generated.',
      patch: { action: 'revise_outline' }
    }
  ] as const;
}

function buildVolumeGateOptions() {
  return [
    {
      optionId: 'accept-volume-plans',
      title: 'Use these volume plans',
      strategy: 'recommended',
      rationale: 'The generated volume plans are persisted and ready for confirmation.',
      impactSummary: 'Approve to continue with the saved volume structure.',
      patch: { action: 'accept_volume_plans' }
    },
    {
      optionId: 'revise-volume-plans',
      title: 'Revise volume plans',
      strategy: 'alternative',
      rationale: 'Pause here if the volume breakdown needs human edits or a refreshed planning pass.',
      impactSummary: 'Keeps the saved plans available for review before downstream chapter work begins.',
      patch: { action: 'revise_volume_plans' }
    }
  ] as const;
}

function normalizeStructuredAgentOutput(result: {
  rawOutput: string;
  parsedOutput: Record<string, unknown> | null;
}): Record<string, unknown> | null {
  if (result.parsedOutput) {
    return result.parsedOutput;
  }

  return parseStructuredJsonOutput(result.rawOutput);
}

function requireRuntimeConfig(deps: OutlineVolumeWorkflowDeps) {
  if (!deps.agentRunner || !deps.defaultProvider || !deps.defaultModel) {
    throw new Error('Outline and volume workflow runtime dependencies are not configured');
  }

  return {
    agentRunner: deps.agentRunner,
    defaultProvider: deps.defaultProvider,
    defaultModel: deps.defaultModel
  };
}

function requireOutlineRecord(
  outline: unknown,
  projectId: string
): Record<string, unknown> {
  if (!outline || typeof outline !== 'object' || Array.isArray(outline)) {
    throw new Error(`Outline not found for project ${projectId}`);
  }

  return outline as Record<string, unknown>;
}

function requireOutlineProject(context: OutlineFlowContext): OutlineProjectWithStoryState {
  if (!context.project) {
    throw new Error(`Outline project prerequisites missing for ${context.projectId}`);
  }

  return context.project;
}

function requireOutlinePrompt(context: OutlineFlowContext): PromptInput {
  if (!context.prompt) {
    throw new Error(`Outline prompt prerequisites missing for ${context.projectId}`);
  }

  return context.prompt;
}

function requireVolumeProject(context: VolumeFlowContext): VolumeProjectInput {
  if (!context.project) {
    throw new Error(`Volume project prerequisites missing for ${context.projectId}`);
  }

  return context.project;
}

function requireVolumePrompt(context: VolumeFlowContext): PromptInput {
  if (!context.prompt) {
    throw new Error(`Volume prompt prerequisites missing for ${context.projectId}`);
  }

  return context.prompt;
}

function requirePersistedOutline(context: OutlineFlowContext): Record<string, unknown> {
  if (!context.outline) {
    throw new Error(`Validated outline missing for ${context.projectId}`);
  }

  return context.outline;
}

function requireValidatedVolumePlans(context: VolumeFlowContext): Array<Record<string, unknown>> {
  if (!context.volumePlans) {
    throw new Error(`Validated volume plans missing for ${context.projectId}`);
  }

  return context.volumePlans;
}

async function requireResolvedGate(
  deps: OutlineVolumeHumanGateReaderDeps,
  projectId: string,
  gateType: 'outline_confirmation' | 'volume_confirmation',
  acceptedOptionId: string
) {
  const latestGate = (await deps.decisionSessionRepository.listSessions())
    .filter((session) => session.projectId === projectId && session.gateType === gateType)
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt ?? 0).getTime();
      const rightTime = new Date(right.updatedAt ?? 0).getTime();

      return rightTime - leftTime;
    })[0];

  if (!latestGate || latestGate.status !== 'resolved' || latestGate.selectedOptionId !== acceptedOptionId) {
    throw new Error(
      `Human gate ${gateType} must be accepted with ${acceptedOptionId} before continuing project ${projectId}`
    );
  }
}

export async function loadOutlineProjectStep(
  context: OutlineFlowContext,
  deps: OutlineVolumeWorkflowDeps
): Promise<OutlineFlowContext> {
  const project = await deps.projectRepository.findByIdWithStoryState(context.projectId);

  if (!project) {
    throw new Error(`Project ${context.projectId} not found`);
  }

  return {
    ...context,
    project
  };
}

export async function loadOutlinePromptStep(
  context: OutlineFlowContext,
  deps: OutlineVolumeWorkflowDeps
): Promise<OutlineFlowContext> {
  const prompt = await deps.promptRepository.findLatestEnabledByAgentName('outline-agent');

  if (!prompt) {
    throw new Error('Prompt config not found for outline-agent');
  }

  return {
    ...context,
    prompt
  };
}

export async function runOutlineAgentStep(
  context: OutlineFlowContext,
  deps: OutlineVolumeWorkflowDeps
): Promise<OutlineFlowContext> {
  const project = requireOutlineProject(context);
  const prompt = requireOutlinePrompt(context);
  const runtime = requireRuntimeConfig(deps);
  const result = await runtime.agentRunner.run({
    agentType: 'outline-agent',
    promptConfigVersion: prompt.version,
    projectId: context.projectId,
    chapterNumber: context.chapterNumber,
    provider: runtime.defaultProvider,
    model: runtime.defaultModel,
    inputSnapshot: {
      systemPrompt: prompt.systemPrompt,
      taskTemplate: prompt.taskTemplate,
      variables: {
        premise: project.premise,
        genre: project.genre
      }
    }
  });

  return {
    ...context,
    rawOutlineOutput: normalizeStructuredAgentOutput(result)
  };
}

export async function validateOutlineOutputStep(
  context: OutlineFlowContext
): Promise<OutlineFlowContext> {
  const parsed = parseOutlineOutput(context.rawOutlineOutput ?? null);

  return {
    ...context,
    outline: parsed.outline,
    storyBible: parsed.storyBible
  };
}

export async function persistOutlineStep(
  context: OutlineFlowContext,
  deps: OutlineVolumeWorkflowDeps & {
    decisionSessionRepository: Pick<DecisionSessionRepository, 'createHumanGateSession'>;
  }
): Promise<OutlineFlowContext> {
  const project = requireOutlineProject(context);
  const outline = requirePersistedOutline(context);
  const storyBible = context.storyBible ?? project.storyState?.storyBible ?? null;

  await deps.storyStateRepository.saveOutline({
    projectId: context.projectId,
    outline,
    storyBible
  });

  const session = await deps.decisionSessionRepository.createHumanGateSession({
    projectId: context.projectId,
    chapterNumber: context.chapterNumber,
    gateType: 'outline_confirmation',
    triggerReason: 'outline_ready_for_confirmation',
    contextSnapshot: {
      outline,
      storyBible
    },
    options: [...buildOutlineGateOptions()],
    recommendedOptionId: 'accept-outline'
  });

  requestHumanGate(session.id);
}

export async function loadVolumeOutlineStep(
  context: VolumeFlowContext,
  deps: OutlineVolumeWorkflowDeps & OutlineVolumeHumanGateReaderDeps
): Promise<VolumeFlowContext> {
  await requireResolvedGate(deps, context.projectId, 'outline_confirmation', 'accept-outline');

  const project = await deps.projectRepository.findByIdWithStoryState(context.projectId);

  if (!project) {
    throw new Error(`Project ${context.projectId} not found`);
  }

  const outline = requireOutlineRecord(project.storyState?.outline, context.projectId);

  return {
    ...context,
    project,
    outline,
    storyBible: typeof project.storyState?.storyBible === 'string' ? project.storyState.storyBible : null
  };
}

export async function loadVolumePromptStep(
  context: VolumeFlowContext,
  deps: OutlineVolumeWorkflowDeps
): Promise<VolumeFlowContext> {
  const prompt = await deps.promptRepository.findLatestEnabledByAgentName('volume-agent');

  if (!prompt) {
    throw new Error('Prompt config not found for volume-agent');
  }

  return {
    ...context,
    prompt
  };
}

export async function runVolumeAgentStep(
  context: VolumeFlowContext,
  deps: OutlineVolumeWorkflowDeps
): Promise<VolumeFlowContext> {
  const project = requireVolumeProject(context);
  const prompt = requireVolumePrompt(context);
  const outline = requireOutlineRecord(context.outline, context.projectId);
  const runtime = requireRuntimeConfig(deps);
  const result = await runtime.agentRunner.run({
    agentType: 'volume-agent',
    promptConfigVersion: prompt.version,
    projectId: context.projectId,
    chapterNumber: context.chapterNumber,
    provider: runtime.defaultProvider,
    model: runtime.defaultModel,
    inputSnapshot: {
      systemPrompt: prompt.systemPrompt,
      taskTemplate: prompt.taskTemplate,
      variables: {
        premise: project.premise,
        genre: project.genre,
        outline,
        storyBible: context.storyBible
      }
    }
  });

  return {
    ...context,
    rawVolumeOutput: normalizeStructuredAgentOutput(result)
  };
}

export async function validateVolumeOutputStep(
  context: VolumeFlowContext
): Promise<VolumeFlowContext> {
  const parsed = parseVolumeOutput(context.rawVolumeOutput ?? null);

  return {
    ...context,
    volumePlans: parsed.plans
  };
}

export async function persistVolumePlansStep(
  context: VolumeFlowContext,
  deps: OutlineVolumeWorkflowDeps & {
    decisionSessionRepository: Pick<DecisionSessionRepository, 'createHumanGateSession'>;
  }
): Promise<VolumeFlowContext> {
  const volumePlans = requireValidatedVolumePlans(context);

  await deps.storyStateRepository.saveVolumePlans({
    projectId: context.projectId,
    plans: volumePlans
  });

  const session = await deps.decisionSessionRepository.createHumanGateSession({
    projectId: context.projectId,
    chapterNumber: context.chapterNumber,
    gateType: 'volume_confirmation',
    triggerReason: 'volume_plans_ready_for_confirmation',
    contextSnapshot: {
      outline: requireOutlineRecord(context.outline, context.projectId),
      storyBible: context.storyBible ?? null,
      volumePlans
    },
    options: [...buildVolumeGateOptions()],
    recommendedOptionId: 'accept-volume-plans'
  });

  requestHumanGate(session.id);
}

export async function executeOutlineStep(
  context: OutlineFlowContext,
  deps: OutlineVolumeWorkflowDeps & {
    decisionSessionRepository: Pick<DecisionSessionRepository, 'createHumanGateSession'>;
  }
): Promise<OutlineFlowContext> {
  const loadedProject = await loadOutlineProjectStep(context, deps);
  const loadedPrompt = await loadOutlinePromptStep(loadedProject, deps);
  const ranAgent = await runOutlineAgentStep(loadedPrompt, deps);
  const validated = await validateOutlineOutputStep(ranAgent);
  return persistOutlineStep(validated, deps);
}

export async function executeVolumeStep(
  context: VolumeFlowContext,
  deps: OutlineVolumeWorkflowDeps & OutlineVolumeHumanGateReaderDeps & {
    decisionSessionRepository: Pick<DecisionSessionRepository, 'createHumanGateSession' | 'listSessions'>;
  }
): Promise<VolumeFlowContext> {
  const loadedOutline = await loadVolumeOutlineStep(context, deps);
  const loadedPrompt = await loadVolumePromptStep(loadedOutline, deps);
  const ranAgent = await runVolumeAgentStep(loadedPrompt, deps);
  const validated = await validateVolumeOutputStep(ranAgent);
  return persistVolumePlansStep(validated, deps);
}
