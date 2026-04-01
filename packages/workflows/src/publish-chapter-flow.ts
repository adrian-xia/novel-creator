import type { WorkflowDefinition } from './create-project-flow';

export function publishChapterFlow(): WorkflowDefinition {
  return {
    name: 'publish-chapter-flow',
    steps: [
      'load-publish-profile',
      'expand-publish-tasks',
      'run-adapter-publishes',
      'run-manual-exports',
      'persist-publish-results'
    ]
  };
}
