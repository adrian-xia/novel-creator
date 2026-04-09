import type { WorkflowTriggerPayload } from './create-project-flow';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface ReviewRewriteFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function reviewRewriteFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  ReviewRewriteFlowContext
> {
  return {
    name: 'review-rewrite-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'load-chapter-draft', run: async (context) => context },
      { name: 'load-review-prompt', run: async (context) => context },
      { name: 'acquire-capacity', run: async (context) => context },
      { name: 'run-review-agent', run: async (context) => context },
      { name: 'persist-review-outcome', run: async (context) => context },
      { name: 'branch-on-review-decision', run: async (context) => context },
      { name: 'enqueue-decision-session-when-blocked', run: async (context) => context },
      { name: 'enqueue-publish-when-approved', run: async (context) => context }
    ]
  };
}
