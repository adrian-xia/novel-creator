import type { WorkflowTriggerPayload } from './create-project-flow';
import { executeReviewRewrite } from './review-rewrite-executors';
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
    steps: [{ name: 'execute-review-rewrite', run: async (context, deps) => executeReviewRewrite(context, deps) }]
  };
}
