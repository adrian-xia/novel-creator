import type { WorkflowTriggerPayload } from './create-project-flow';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface PublishChapterFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function publishChapterFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  PublishChapterFlowContext
> {
  return {
    name: 'publish-chapter-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'load-publish-profile', run: async (context) => context },
      { name: 'expand-publish-tasks', run: async (context) => context },
      { name: 'run-adapter-publishes', run: async (context) => context },
      { name: 'run-manual-exports', run: async (context) => context },
      { name: 'persist-publish-results', run: async (context) => context }
    ]
  };
}
