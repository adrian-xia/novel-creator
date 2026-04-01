import type { WorkflowDefinition } from './create-project-flow';

export function decisionSessionFlow(): WorkflowDefinition {
  return {
    name: 'decision-session-flow',
    steps: [
      'load-blocked-review',
      'build-decision-packet',
      'create-decision-session',
      'await-human-and-assistant-conversation',
      'persist-decision-resolution',
      'apply-resolution'
    ]
  };
}
