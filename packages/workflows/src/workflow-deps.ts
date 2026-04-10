import type { DecisionSessionRepository } from '../../storage/src/repositories/decision-session-repository';
import type { PromptRepository } from '../../storage/src/repositories/prompt-repository';
import type { ProjectRepository } from '../../storage/src/repositories/project-repository';
import type { StoryStateRepository } from '../../storage/src/repositories/story-state-repository';

export interface WorkflowAgentRunner {
  run(input: {
    agentType: string;
    promptConfigVersion: number;
    projectId: string;
    chapterNumber: number | null;
    provider: string;
    model: string;
    inputSnapshot: Record<string, unknown>;
  }): Promise<{
    rawOutput: string;
    parsedOutput: Record<string, unknown> | null;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
}

export type WorkflowDeps = {
  promptRepository: PromptRepository;
  projectRepository: ProjectRepository;
  storyStateRepository: StoryStateRepository;
  decisionSessionRepository: DecisionSessionRepository;
  agentRunner: WorkflowAgentRunner;
  defaultProvider: string;
  defaultModel: string;
};
