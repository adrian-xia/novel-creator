import type { WorkflowDefinition } from './create-project-flow';

export function decisionSessionFlow(): WorkflowDefinition {
  return {
    name: 'decision-session-flow',
    steps: [
      'append-human-message',
      'load-decision-context',
      'assemble-decision-conversation-context',
      'run-decision-assistant',
      'persist-assistant-message',
      'generate-resolution-draft',
      'persist-resolution',
      'apply-resolution',
      'invalidate-plans-in-window',
      'enqueue-replan-window'
    ]
  };
}
