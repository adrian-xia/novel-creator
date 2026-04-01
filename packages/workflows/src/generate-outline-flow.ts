import type { WorkflowDefinition } from './create-project-flow';

export function generateOutlineFlow(): WorkflowDefinition {
  return {
    name: 'generate-outline-flow',
    steps: [
      'load-project-input',
      'load-outline-prompt',
      'acquire-capacity',
      'run-outline-agent',
      'validate-outline-output',
      'persist-outline',
      'record-agent-run'
    ]
  };
}
