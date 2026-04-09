import type { PromptRepository } from '../../storage/src/repositories/prompt-repository';
import type { ProjectRepository } from '../../storage/src/repositories/project-repository';
import type { StoryStateRepository } from '../../storage/src/repositories/story-state-repository';

export type WorkflowDeps = {
  promptRepository: PromptRepository;
  projectRepository: ProjectRepository;
  storyStateRepository: StoryStateRepository;
};
