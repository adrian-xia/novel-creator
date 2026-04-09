import type { WorkflowTriggerPayload } from './create-project-flow';
import { executeGenerateChapter } from './chapter-executors';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface ChapterFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function generateChapterFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  ChapterFlowContext
> {
  return {
    name: 'generate-chapter-flow',
    buildInitialContext: (payload) => payload,
    steps: [{ name: 'execute-chapter-generation', run: async (context, deps) => executeGenerateChapter(context, deps) }]
  };
}
