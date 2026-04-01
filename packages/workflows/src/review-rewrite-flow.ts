import type { WorkflowDefinition } from './create-project-flow';

export function reviewRewriteFlow(): WorkflowDefinition {
  return {
    name: 'review-rewrite-flow',
    steps: [
      'load-chapter-draft',
      'load-review-prompt',
      'acquire-capacity',
      'run-review-agent',
      'persist-review-outcome',
      'branch-on-review-decision',
      'enqueue-decision-session-when-blocked',
      'enqueue-publish-when-approved'
    ]
  };
}
