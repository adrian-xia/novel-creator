import type { WorkflowDefinition } from './create-project-flow';

export function generateChapterFlow(): WorkflowDefinition {
  return {
    name: 'generate-chapter-flow',
    steps: [
      'lock-project-chapter-pipeline',
      'load-story-state',
      'load-chapter-plan-prompt',
      'acquire-capacity',
      'run-chapter-plan-agent',
      'persist-chapter-plan',
      'load-chapter-draft-prompt',
      'run-chapter-draft-agent',
      'persist-chapter-draft',
      'mark-chapter-drafted'
    ]
  };
}
