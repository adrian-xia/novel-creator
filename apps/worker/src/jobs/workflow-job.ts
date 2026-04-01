import {
  createProjectFlow,
  enqueueWorkflow,
  decisionSessionFlow,
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow,
  reviewRewriteFlow
} from '../../../../packages/workflows/src';

export async function runWorkflowJob(jobName: string) {
  const flowMap = {
    'create-project-flow': createProjectFlow(),
    'generate-outline-flow': generateOutlineFlow(),
    'generate-volume-flow': generateVolumeFlow(),
    'generate-chapter-flow': generateChapterFlow(),
    'review-rewrite-flow': reviewRewriteFlow(),
    'decision-session-flow': decisionSessionFlow()
  } as const;

  const flow = flowMap[jobName as keyof typeof flowMap] ?? { name: jobName, steps: [] };

  return enqueueWorkflow(flow);
}
