import type { PromptRepository } from '../../storage/src/repositories/prompt-repository';
import type { ProjectRepository } from '../../storage/src/repositories/project-repository';
import type { StoryStateRepository } from '../../storage/src/repositories/story-state-repository';
import type { OutlineFlowContext } from './generate-outline-flow';
import type { VolumeFlowContext } from './generate-volume-flow';
import { parseOutlineOutput, parseVolumeOutput } from './outline-volume-parsers';

interface AgentRunnerResult {
  parsedOutput: Record<string, unknown> | null;
}

interface AgentRunner {
  run(input: {
    agentType: string;
    promptConfigVersion: number;
    projectId: string;
    chapterNumber: number | null;
    provider: string;
    model: string;
    inputSnapshot: Record<string, unknown>;
  }): Promise<AgentRunnerResult>;
}

interface OutlineVolumeWorkflowDeps {
  projectRepository: Pick<ProjectRepository, 'findById' | 'findByIdWithStoryState'>;
  promptRepository: Pick<PromptRepository, 'findLatestEnabledByAgentName'>;
  storyStateRepository: Pick<StoryStateRepository, 'saveOutline' | 'saveVolumePlans'>;
  agentRunner?: AgentRunner;
  defaultProvider?: string;
  defaultModel?: string;
}

type OutlineExecutionContext = OutlineFlowContext & {
  outline?: Record<string, unknown>;
  storyBible?: string | null;
};

type VolumeExecutionContext = VolumeFlowContext & {
  outline?: Record<string, unknown>;
  storyBible?: string | null;
  volumePlans?: Array<Record<string, unknown>>;
};

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

export async function executeOutlineStep(
  context: OutlineFlowContext,
  deps: OutlineVolumeWorkflowDeps
): Promise<OutlineExecutionContext> {
  const project = await deps.projectRepository.findById(context.projectId);

  if (!project) {
    throw new Error(`Project ${context.projectId} not found`);
  }

  const prompt = await deps.promptRepository.findLatestEnabledByAgentName('outline-agent');

  if (!prompt) {
    throw new Error('Prompt config not found for outline-agent');
  }

  const runtime = requireRuntimeConfig(deps);
  const result = await runtime.agentRunner.run({
    agentType: 'outline-agent',
    promptConfigVersion: prompt.version,
    projectId: context.projectId,
    chapterNumber: context.chapterNumber,
    provider: runtime.defaultProvider,
    model: runtime.defaultModel,
    inputSnapshot: {
      premise: project.premise,
      genre: project.genre
    }
  });

  const parsed = parseOutlineOutput(result.parsedOutput);

  await deps.storyStateRepository.saveOutline({
    projectId: context.projectId,
    outline: parsed.outline,
    storyBible: parsed.storyBible
  });

  return {
    ...context,
    outline: parsed.outline,
    storyBible: parsed.storyBible
  };
}

export async function executeVolumeStep(
  context: VolumeFlowContext,
  deps: OutlineVolumeWorkflowDeps
): Promise<VolumeExecutionContext> {
  const project = await deps.projectRepository.findByIdWithStoryState(context.projectId);

  if (!project) {
    throw new Error(`Project ${context.projectId} not found`);
  }

  const outline = requireOutlineRecord(project.storyState?.outline, context.projectId);
  const storyBible =
    typeof project.storyState?.storyBible === 'string' ? project.storyState.storyBible : null;
  const prompt = await deps.promptRepository.findLatestEnabledByAgentName('volume-agent');

  if (!prompt) {
    throw new Error('Prompt config not found for volume-agent');
  }

  const runtime = requireRuntimeConfig(deps);
  const result = await runtime.agentRunner.run({
    agentType: 'volume-agent',
    promptConfigVersion: prompt.version,
    projectId: context.projectId,
    chapterNumber: context.chapterNumber,
    provider: runtime.defaultProvider,
    model: runtime.defaultModel,
    inputSnapshot: {
      premise: project.premise,
      genre: project.genre,
      outline,
      storyBible
    }
  });

  const parsed = parseVolumeOutput(result.parsedOutput);

  await deps.storyStateRepository.saveVolumePlans({
    projectId: context.projectId,
    plans: parsed.plans
  });

  return {
    ...context,
    outline,
    storyBible,
    volumePlans: parsed.plans
  };
}
