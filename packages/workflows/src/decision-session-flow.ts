import type { WorkflowTriggerPayload } from './create-project-flow';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface DecisionSessionFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function decisionSessionFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  DecisionSessionFlowContext
> {
  return {
    name: 'decision-session-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'append-human-message', run: async (context) => context },
      { name: 'load-decision-context', run: async (context) => context },
      { name: 'assemble-decision-conversation-context', run: async (context) => context },
      { name: 'run-decision-assistant', run: async (context) => context },
      { name: 'persist-assistant-message', run: async (context) => context },
      { name: 'generate-resolution-draft', run: async (context) => context },
      { name: 'persist-resolution', run: async (context) => context },
      { name: 'apply-resolution', run: async (context) => context },
      { name: 'invalidate-plans-in-window', run: async (context) => context },
      { name: 'enqueue-replan-window', run: async (context) => context }
    ]
  };
}
