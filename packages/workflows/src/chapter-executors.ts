import type { PromptRepository } from '../../storage/src/repositories/prompt-repository';
import type { StoryStateRepository } from '../../storage/src/repositories/story-state-repository';
import { acquireChapterPipelineLock, releaseChapterPipelineLock } from './chapter-lock';
import type { ChapterFlowContext } from './generate-chapter-flow';
import { parseStructuredJsonOutput } from './structured-output';
import type { WorkflowAgentRunner } from './workflow-deps';

interface ChapterWorkflowDeps {
  promptRepository: Pick<PromptRepository, 'findLatestEnabledByAgentName'>;
  storyStateRepository: Pick<
    StoryStateRepository,
    | 'getStoryState'
    | 'getNextChapterNumber'
    | 'invalidateChapterPlansInRange'
    | 'saveChapterPlan'
    | 'saveChapterDraft'
    | 'saveChapterState'
  >;
  agentRunner?: WorkflowAgentRunner;
  defaultProvider?: string;
  defaultModel?: string;
}

type StoryStateContext = {
  volumePlans: Array<Record<string, unknown>>;
  confirmedFacts: string[];
  openForeshadowing: string[];
  chapterSummaries: Array<{ chapterNumber: number; summary: string }>;
  currentPosition: {
    nextChapterNumber: number;
    currentVolumeNumber: number | null;
  };
};

type PromptInput = {
  agentName: string;
  version: number;
  systemPrompt: string;
  taskTemplate: string;
};

function requireRuntimeConfig(deps: ChapterWorkflowDeps) {
  if (!deps.agentRunner || !deps.defaultProvider || !deps.defaultModel) {
    throw new Error('Chapter workflow runtime dependencies are not configured');
  }

  return {
    agentRunner: deps.agentRunner,
    defaultProvider: deps.defaultProvider,
    defaultModel: deps.defaultModel
  };
}

function requireStoryState(
  storyState: Awaited<ReturnType<ChapterWorkflowDeps['storyStateRepository']['getStoryState']>>,
  projectId: string
): StoryStateContext {
  if (
    !storyState ||
    !storyState.currentPosition ||
    storyState.currentPosition.currentVolumeNumber === null ||
    !Array.isArray(storyState.volumePlans) ||
    storyState.volumePlans.length === 0
  ) {
    throw new Error(`Story state is not ready for next chapter generation: ${projectId}`);
  }

  return {
    volumePlans: storyState.volumePlans as Array<Record<string, unknown>>,
    confirmedFacts: Array.isArray(storyState.confirmedFacts) ? storyState.confirmedFacts : [],
    openForeshadowing: Array.isArray(storyState.openForeshadowing)
      ? storyState.openForeshadowing
      : [],
    chapterSummaries: Array.isArray(storyState.chapterSummaries)
      ? storyState.chapterSummaries
      : [],
    currentPosition: storyState.currentPosition
  };
}

function normalizeStructuredAgentOutput(result: {
  rawOutput: string;
  parsedOutput: Record<string, unknown> | null;
}) {
  if (result.parsedOutput) {
    return result.parsedOutput;
  }

  return parseStructuredJsonOutput(result.rawOutput);
}

function requirePrompt(prompt: PromptInput | null, agentName: string) {
  if (!prompt) {
    throw new Error(`Prompt config not found for ${agentName}`);
  }

  return prompt;
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function requireNonEmptyString(value: unknown, message: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }

  return value;
}

function parseChapterPlanOutput(output: Record<string, unknown> | null) {
  if (!output) {
    throw new Error('Invalid chapter plan output: missing plan object');
  }

  return {
    title: requireNonEmptyString(output.title, 'Invalid chapter plan output: missing title'),
    goal: requireNonEmptyString(output.goal, 'Invalid chapter plan output: missing goal'),
    beats: toStringList(output.beats),
    povCharacter: typeof output.povCharacter === 'string' ? output.povCharacter : '',
    hardConstraints: toStringList(output.hardConstraints)
  };
}

export async function executeGenerateChapter(
  context: ChapterFlowContext,
  deps: ChapterWorkflowDeps
): Promise<ChapterFlowContext> {
  await acquireChapterPipelineLock(context.projectId);

  try {
    const storyState = requireStoryState(
      await deps.storyStateRepository.getStoryState(context.projectId),
      context.projectId
    );
    const chapterNumber = await deps.storyStateRepository.getNextChapterNumber(context.projectId);
    const runtime = requireRuntimeConfig(deps);
    const chapterPlanPrompt = requirePrompt(
      await deps.promptRepository.findLatestEnabledByAgentName('chapter-plan-agent'),
      'chapter-plan-agent'
    );

    const planResult = await runtime.agentRunner.run({
      agentType: 'chapter-plan-agent',
      promptConfigVersion: chapterPlanPrompt.version,
      projectId: context.projectId,
      chapterNumber,
      provider: runtime.defaultProvider,
      model: runtime.defaultModel,
      inputSnapshot: {
        systemPrompt: chapterPlanPrompt.systemPrompt,
        taskTemplate: chapterPlanPrompt.taskTemplate,
        variables: {
          chapterNumber,
          currentPosition: storyState.currentPosition,
          recentChapterSummaries: storyState.chapterSummaries.map((item) => item.summary),
          openForeshadowing: storyState.openForeshadowing,
          confirmedFacts: storyState.confirmedFacts
        }
      }
    });
    const parsedPlan = parseChapterPlanOutput(normalizeStructuredAgentOutput(planResult));

    await deps.storyStateRepository.invalidateChapterPlansInRange({
      projectId: context.projectId,
      startChapter: chapterNumber,
      endChapter: chapterNumber
    });
    await deps.storyStateRepository.saveChapterPlan({
      projectId: context.projectId,
      chapterNumber,
      title: parsedPlan.title,
      goal: parsedPlan.goal,
      beats: parsedPlan.beats,
      povCharacter: parsedPlan.povCharacter,
      hardConstraints: parsedPlan.hardConstraints
    });
    await deps.storyStateRepository.saveChapterState({
      projectId: context.projectId,
      chapterNumber,
      status: 'planned'
    });

    const chapterDraftPrompt = requirePrompt(
      await deps.promptRepository.findLatestEnabledByAgentName('chapter-draft-agent'),
      'chapter-draft-agent'
    );

    const draftResult = await runtime.agentRunner.run({
      agentType: 'chapter-draft-agent',
      promptConfigVersion: chapterDraftPrompt.version,
      projectId: context.projectId,
      chapterNumber,
      provider: runtime.defaultProvider,
      model: runtime.defaultModel,
      inputSnapshot: {
        systemPrompt: chapterDraftPrompt.systemPrompt,
        taskTemplate: chapterDraftPrompt.taskTemplate,
        variables: {
          chapterNumber,
          chapterPlan: parsedPlan,
          recentChapterSummaries: storyState.chapterSummaries.map((item) => item.summary),
          openForeshadowing: storyState.openForeshadowing,
          confirmedFacts: storyState.confirmedFacts,
          currentPosition: storyState.currentPosition
        }
      }
    });
    await deps.storyStateRepository.saveChapterDraft({
      projectId: context.projectId,
      chapterNumber,
      version: 1,
      content: requireNonEmptyString(
        draftResult.rawOutput,
        'Invalid chapter draft output: empty content'
      ),
      summary: null,
      metadata: {}
    });

    await deps.storyStateRepository.saveChapterState({
      projectId: context.projectId,
      chapterNumber,
      status: 'drafted'
    });

    return {
      ...context,
      chapterNumber
    };
  } finally {
    await releaseChapterPipelineLock(context.projectId);
  }
}
