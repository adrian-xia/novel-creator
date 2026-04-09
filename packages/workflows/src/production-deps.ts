import { PromptRepository } from '../../storage/src/repositories/prompt-repository';
import { ProjectRepository } from '../../storage/src/repositories/project-repository';
import { StoryStateRepository } from '../../storage/src/repositories/story-state-repository';
import type { WorkflowDeps } from './workflow-deps';

export function createProductionWorkflowDeps(): WorkflowDeps {
  return {
    promptRepository: new PromptRepository(),
    projectRepository: new ProjectRepository(),
    storyStateRepository: new StoryStateRepository()
  };
}
