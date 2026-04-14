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
import { createProductionWorkflowDeps } from '../../../../packages/workflows/src/production-deps';
import { runInstrumentedWorkflow } from '../../../../packages/workflows/src/workflow-runner';

type WorkflowJobPayload = {
  projectId?: string;
  chapterNumber?: number;
  autoContinueBudget?: number;
};

function buildFlowMap() {
  return {
    'chapter-replan-flow': chapterReplanFlow(),
    'create-project-flow': createProjectFlow(),
    'generate-outline-flow': generateOutlineFlow(),
    'generate-volume-flow': generateVolumeFlow(),
    'generate-chapter-flow': generateChapterFlow(),
    'publish-chapter-flow': publishChapterFlow(),
    'review-rewrite-flow': reviewRewriteFlow(),
    'decision-session-flow': decisionSessionFlow()
  } as const;
}

async function shouldAutoContinueChapter(input: {
  projectId: string;
  result: unknown;
  deps: ReturnType<typeof createProductionWorkflowDeps>;
}) {
  if (!input.result || typeof input.result !== 'object') {
    return false;
  }

  const result = input.result as {
    chapterNumber?: number | null;
    reviewDecision?: string;
    waitingForHumanGate?: string;
  };

  if (
    result.waitingForHumanGate ||
    result.reviewDecision !== 'approve' ||
    typeof result.chapterNumber !== 'number'
  ) {
    return false;
  }

  const openSessions = (await input.deps.decisionSessionRepository.listSessions()).filter(
    (session) =>
      session.projectId === input.projectId &&
      session.status !== 'resolved' &&
      session.status !== 'cancelled'
  );

  if (openSessions.length > 0) {
    return false;
  }

  const pendingRecoveryTask = await input.deps.decisionRecoveryRepository.findLatestPendingTask(
    input.projectId
  );

  if (pendingRecoveryTask) {
    return false;
  }

  const activeWorkflowRun = await input.deps.workflowRunRepository.findLatestActiveRun(
    input.projectId
  );

  return activeWorkflowRun === null;
}

async function executeWorkflowJob(
  jobName: string,
  payload: WorkflowJobPayload,
  deps: ReturnType<typeof createProductionWorkflowDeps>
) {
  const flowMap = buildFlowMap();
  const flow = flowMap[jobName as keyof ReturnType<typeof buildFlowMap>];

  if (!flow) {
    throw new Error(`Unknown workflow job: ${jobName}`);
  }

  return runInstrumentedWorkflow({
    flow,
    payload: {
      projectId: payload.projectId ?? 'system',
      chapterNumber: payload.chapterNumber ?? null
    },
    deps
  });
}

export async function runWorkflowJob(
  jobName: string,
  payload: WorkflowJobPayload = {}
) {
  const deps = createProductionWorkflowDeps();
  const result = await executeWorkflowJob(jobName, payload, deps);
  const autoContinueBudget =
    jobName === 'generate-chapter-flow' ? Math.max(payload.autoContinueBudget ?? 0, 0) : 0;

  if (
    autoContinueBudget > 0 &&
    payload.projectId &&
    (await shouldAutoContinueChapter({
      projectId: payload.projectId,
      result,
      deps
    }))
  ) {
    await executeWorkflowJob(
      'generate-chapter-flow',
      {
        projectId: payload.projectId,
        chapterNumber: null,
        autoContinueBudget: autoContinueBudget - 1
      },
      deps
    );

    if (result && typeof result === 'object') {
      return {
        ...(result as Record<string, unknown>),
        autoContinuedChapters: 1
      };
    }
  }

  if (jobName === 'generate-chapter-flow' && result && typeof result === 'object') {
    return {
      ...(result as Record<string, unknown>),
      autoContinuedChapters: 0
    };
  }

  return result;
}
