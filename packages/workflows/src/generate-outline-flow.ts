import type { WorkflowTriggerPayload } from './create-project-flow';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface OutlineFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function generateOutlineFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  OutlineFlowContext,
  Record<string, never>
> {
  return {
    name: 'generate-outline-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'load-project-input', run: async (context) => context },
      { name: 'load-outline-prompt', run: async (context) => context },
      { name: 'run-outline-agent', run: async (context) => context },
      { name: 'persist-outline', run: async (context) => context }
    ]
  };
}
