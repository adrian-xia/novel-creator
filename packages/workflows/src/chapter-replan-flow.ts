import type { WorkflowDefinition } from './create-project-flow';

export function chapterReplanFlow(): WorkflowDefinition {
  return {
    name: 'chapter-replan-flow',
    steps: [
      'load-recovery-task',
      'invalidate-plans-in-window',
      'set-chapters-needs-replan',
      'enqueue-replan-window',
      'mark-recovery-task-complete'
    ]
  };
}
