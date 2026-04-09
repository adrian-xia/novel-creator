import type { WorkflowTriggerPayload } from './create-project-flow';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface ChapterFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function generateChapterFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  ChapterFlowContext,
  Record<string, never>
> {
  return {
    name: 'generate-chapter-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'lock-project-chapter-pipeline', run: async (context) => context },
      { name: 'load-story-state', run: async (context) => context },
      { name: 'load-chapter-plan-prompt', run: async (context) => context },
      { name: 'acquire-capacity', run: async (context) => context },
      { name: 'run-chapter-plan-agent', run: async (context) => context },
      { name: 'persist-chapter-plan', run: async (context) => context },
      { name: 'load-chapter-draft-prompt', run: async (context) => context },
      { name: 'run-chapter-draft-agent', run: async (context) => context },
      { name: 'persist-chapter-draft', run: async (context) => context },
      { name: 'mark-chapter-drafted', run: async (context) => context }
    ]
  };
}
