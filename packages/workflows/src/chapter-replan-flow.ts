import type { WorkflowTriggerPayload } from './create-project-flow';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface ChapterReplanFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function chapterReplanFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  ChapterReplanFlowContext
> {
  return {
    name: 'chapter-replan-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'load-recovery-task', run: async (context) => context },
      { name: 'invalidate-plans-in-window', run: async (context) => context },
      { name: 'set-chapters-needs-replan', run: async (context) => context },
      { name: 'enqueue-replan-window', run: async (context) => context },
      { name: 'mark-recovery-task-complete', run: async (context) => context }
    ]
  };
}
