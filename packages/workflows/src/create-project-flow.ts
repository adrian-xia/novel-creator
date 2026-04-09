import type { ExecutableWorkflow } from './workflow-runtime';

export interface WorkflowTriggerPayload {
  projectId: string;
  chapterNumber: number | null;
}

export interface CreateProjectFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function createProjectFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  CreateProjectFlowContext
> {
  return {
    name: 'create-project-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'persist-project', run: async (context) => context },
      { name: 'enqueue-outline', run: async (context) => context },
      { name: 'mark-project-active', run: async (context) => context }
    ]
  };
}
