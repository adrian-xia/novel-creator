import {
  chapterReplanFlow,
  createProjectFlow,
  decisionSessionFlow,
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow,
  publishChapterFlow,
  reviewRewriteFlow
} from '../../../../packages/workflows/src';
import { runInstrumentedWorkflow } from '../../../../packages/workflows/src/workflow-runner';

export async function runWorkflowJob(
  jobName: string,
  payload: { projectId?: string; chapterNumber?: number } = {}
) {
  const flowMap = {
    'chapter-replan-flow': chapterReplanFlow(),
    'create-project-flow': createProjectFlow(),
    'generate-outline-flow': generateOutlineFlow(),
    'generate-volume-flow': generateVolumeFlow(),
    'generate-chapter-flow': generateChapterFlow(),
    'publish-chapter-flow': publishChapterFlow(),
    'review-rewrite-flow': reviewRewriteFlow(),
    'decision-session-flow': decisionSessionFlow()
  } as const;

  const flow = flowMap[jobName as keyof typeof flowMap] ?? { name: jobName, steps: [] };

  return runInstrumentedWorkflow({
    flow,
    payload: {
      projectId: payload.projectId ?? 'system',
      chapterNumber: payload.chapterNumber ?? null
    }
  });
}
