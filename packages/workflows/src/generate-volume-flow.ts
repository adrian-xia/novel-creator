import type { WorkflowTriggerPayload } from './create-project-flow';
import { executeVolumeStep } from './outline-volume-executors';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface VolumeFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function generateVolumeFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  VolumeFlowContext
> {
  return {
    name: 'generate-volume-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'load-outline', run: async (context) => context },
      { name: 'load-volume-prompt', run: async (context) => context },
      { name: 'acquire-capacity', run: async (context) => context },
      { name: 'run-volume-agent', run: async (context, deps) => executeVolumeStep(context, deps) },
      { name: 'validate-volume-output', run: async (context) => context },
      { name: 'persist-volume-plans', run: async (context) => context },
      { name: 'record-agent-run', run: async (context) => context }
    ]
  };
}
