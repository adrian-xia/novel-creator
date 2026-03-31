import type { WorkflowDefinition } from './create-project-flow';

export function generateOutlineFlow(): WorkflowDefinition {
  return {
    name: 'generate-outline-flow',
    steps: ['load-project-context', 'generate-outline', 'review-outline']
  };
}
