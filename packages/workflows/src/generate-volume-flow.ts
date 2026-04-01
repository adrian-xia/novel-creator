import type { WorkflowDefinition } from './create-project-flow';

export function generateVolumeFlow(): WorkflowDefinition {
  return {
    name: 'generate-volume-flow',
    steps: [
      'load-outline',
      'load-volume-prompt',
      'acquire-capacity',
      'run-volume-agent',
      'validate-volume-output',
      'persist-volume-plans',
      'record-agent-run'
    ]
  };
}
