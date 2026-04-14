import type { DecisionRecoveryRepository } from '../../storage/src/repositories/decision-recovery-repository';
import type { ProjectRepository } from '../../storage/src/repositories/project-repository';
import type { WorkflowRunRepository } from '../../storage/src/repositories/workflow-run-repository';
import { chapterReplanFlow } from './chapter-replan-flow';
import { enqueueWorkflow } from './enqueue';
import { generateChapterFlow } from './generate-chapter-flow';
import { generateOutlineFlow } from './generate-outline-flow';
import { generateVolumeFlow } from './generate-volume-flow';

export type ProductionPhase =
  | 'needs_outline'
  | 'waiting_outline_confirmation'
  | 'needs_volume'
  | 'waiting_volume_confirmation'
  | 'needs_chapter_generation'
  | 'blocked_for_decision'
  | 'needs_replan_recovery'
  | 'running_workflow'
  | 'paused';

export type ContinueProjectAction =
  | 'generate_outline'
  | 'generate_volume'
  | 'generate_next_chapter'
  | 'run_replan_recovery'
  | 'open_human_gate'
  | 'wait_for_running_workflow'
  | 'none';

export interface ProductionStatus {
  phase: ProductionPhase;
  canContinue: boolean;
  recommendedAction: ContinueProjectAction;
  reason: string;
  activeWorkflowRunId: string | null;
  openSessionId: string | null;
  pendingRecoveryTaskId: string | null;
  nextChapterNumber: number | null;
  autoContinueBudget: number;
}

export interface ContinueProjectResult {
  projectId: string;
  continued: boolean;
  action: ContinueProjectAction;
  reason: string;
  workflowRunId: string | null;
  flowName: string | null;
  autoContinuedChapters: number;
  status?: 'queued';
  steps?: string[];
}

type ProjectDetail = Awaited<ReturnType<ProjectRepository['getProjectDecisionAndPublishingDetail']>>;
type ActiveWorkflowRun = Awaited<ReturnType<WorkflowRunRepository['findLatestActiveRun']>>;
type PendingRecoveryTask = Awaited<ReturnType<DecisionRecoveryRepository['findLatestPendingTask']>>;

type ProjectContinueDeps = {
  projectRepository: Pick<ProjectRepository, 'getProjectDecisionAndPublishingDetail'>;
  workflowRunRepository: Pick<WorkflowRunRepository, 'createRun' | 'findLatestActiveRun'>;
  decisionRecoveryRepository: Pick<DecisionRecoveryRepository, 'findLatestPendingTask'>;
};

const AUTO_CONTINUE_BUDGET = 1;

function getNextChapterNumber(detail: NonNullable<ProjectDetail>): number | null {
  const nextChapterNumber = detail.storyState?.currentPosition?.nextChapterNumber;

  if (typeof nextChapterNumber === 'number' && Number.isInteger(nextChapterNumber) && nextChapterNumber > 0) {
    return nextChapterNumber;
  }

  const chapterNumbers = detail.chapterStateRecords
    .map((record) => record.chapterNumber)
    .filter((value) => Number.isInteger(value) && value > 0);

  if (chapterNumbers.length === 0) {
    return 1;
  }

  return Math.max(...chapterNumbers) + 1;
}

function getOpenSession(detail: NonNullable<ProjectDetail>) {
  return detail.decisionSessions.find((session) => session.status !== 'resolved' && session.status !== 'cancelled') ?? null;
}

function hasOutline(detail: NonNullable<ProjectDetail>) {
  const outline = detail.storyState?.outline;

  return !!outline && typeof outline === 'object' && !Array.isArray(outline);
}

function hasVolumePlans(detail: NonNullable<ProjectDetail>) {
  return Array.isArray(detail.storyState?.volumePlans) && detail.storyState!.volumePlans.length > 0;
}

export function buildProductionStatus(input: {
  detail: ProjectDetail;
  activeWorkflowRun: ActiveWorkflowRun;
  pendingRecoveryTask: PendingRecoveryTask;
}): ProductionStatus {
  if (!input.detail) {
    return {
      phase: 'paused',
      canContinue: false,
      recommendedAction: 'none',
      reason: 'Project was not found.',
      activeWorkflowRunId: null,
      openSessionId: null,
      pendingRecoveryTaskId: null,
      nextChapterNumber: null,
      autoContinueBudget: AUTO_CONTINUE_BUDGET
    };
  }

  const nextChapterNumber = getNextChapterNumber(input.detail);
  const openSession = getOpenSession(input.detail);

  if (input.activeWorkflowRun) {
    return {
      phase: 'running_workflow',
      canContinue: false,
      recommendedAction: 'wait_for_running_workflow',
      reason: 'Project already has an active workflow run in progress.',
      activeWorkflowRunId: input.activeWorkflowRun.id,
      openSessionId: null,
      pendingRecoveryTaskId: input.pendingRecoveryTask?.id ?? null,
      nextChapterNumber,
      autoContinueBudget: AUTO_CONTINUE_BUDGET
    };
  }

  if (openSession) {
    if (openSession.gateType === 'outline_confirmation') {
      return {
        phase: 'waiting_outline_confirmation',
        canContinue: false,
        recommendedAction: 'open_human_gate',
        reason: 'Project is waiting for outline confirmation.',
        activeWorkflowRunId: null,
        openSessionId: openSession.id,
        pendingRecoveryTaskId: input.pendingRecoveryTask?.id ?? null,
        nextChapterNumber,
        autoContinueBudget: AUTO_CONTINUE_BUDGET
      };
    }

    if (openSession.gateType === 'volume_confirmation') {
      return {
        phase: 'waiting_volume_confirmation',
        canContinue: false,
        recommendedAction: 'open_human_gate',
        reason: 'Project is waiting for volume plan confirmation.',
        activeWorkflowRunId: null,
        openSessionId: openSession.id,
        pendingRecoveryTaskId: input.pendingRecoveryTask?.id ?? null,
        nextChapterNumber,
        autoContinueBudget: AUTO_CONTINUE_BUDGET
      };
    }

    return {
      phase: 'blocked_for_decision',
      canContinue: false,
      recommendedAction: 'open_human_gate',
      reason: 'Project is blocked by an open decision session.',
      activeWorkflowRunId: null,
      openSessionId: openSession.id,
      pendingRecoveryTaskId: input.pendingRecoveryTask?.id ?? null,
      nextChapterNumber,
      autoContinueBudget: AUTO_CONTINUE_BUDGET
    };
  }

  if (input.pendingRecoveryTask) {
    return {
      phase: 'needs_replan_recovery',
      canContinue: true,
      recommendedAction: 'run_replan_recovery',
      reason: 'Project has a pending recovery task that should run before new generation.',
      activeWorkflowRunId: null,
      openSessionId: null,
      pendingRecoveryTaskId: input.pendingRecoveryTask.id,
      nextChapterNumber,
      autoContinueBudget: AUTO_CONTINUE_BUDGET
    };
  }

  if (!hasOutline(input.detail) && !hasVolumePlans(input.detail)) {
    return {
      phase: 'needs_outline',
      canContinue: true,
      recommendedAction: 'generate_outline',
      reason: 'Project does not have an outline yet.',
      activeWorkflowRunId: null,
      openSessionId: null,
      pendingRecoveryTaskId: null,
      nextChapterNumber,
      autoContinueBudget: AUTO_CONTINUE_BUDGET
    };
  }

  if (!hasVolumePlans(input.detail)) {
    return {
      phase: 'needs_volume',
      canContinue: true,
      recommendedAction: 'generate_volume',
      reason: 'Project is ready to generate volume plans.',
      activeWorkflowRunId: null,
      openSessionId: null,
      pendingRecoveryTaskId: null,
      nextChapterNumber,
      autoContinueBudget: AUTO_CONTINUE_BUDGET
    };
  }

  return {
    phase: 'needs_chapter_generation',
    canContinue: true,
    recommendedAction: 'generate_next_chapter',
    reason: 'Project is ready to generate the next chapter.',
    activeWorkflowRunId: null,
    openSessionId: null,
    pendingRecoveryTaskId: null,
    nextChapterNumber,
    autoContinueBudget: AUTO_CONTINUE_BUDGET
  };
}

async function getDefaultDeps(): Promise<ProjectContinueDeps> {
  const [{ ProjectRepository }, { WorkflowRunRepository }, { DecisionRecoveryRepository }] = await Promise.all([
    import('../../storage/src/repositories/project-repository'),
    import('../../storage/src/repositories/workflow-run-repository'),
    import('../../storage/src/repositories/decision-recovery-repository')
  ]);

  return {
    projectRepository: new ProjectRepository(),
    workflowRunRepository: new WorkflowRunRepository(),
    decisionRecoveryRepository: new DecisionRecoveryRepository()
  };
}

async function queueProjectFlow(input: {
  projectId: string;
  flow: ReturnType<
    typeof generateOutlineFlow | typeof generateVolumeFlow | typeof generateChapterFlow | typeof chapterReplanFlow
  >;
  chapterNumber: number | null;
  workflowRunRepository: Pick<WorkflowRunRepository, 'createRun'>;
}) {
  const workflowRun = await input.workflowRunRepository.createRun({
    flowName: input.flow.name,
    projectId: input.projectId,
    chapterNumber: input.chapterNumber
  });

  return {
    workflowRunId: workflowRun.id,
    ...enqueueWorkflow(input.flow)
  };
}

export async function continueProject(
  projectId: string,
  providedDeps?: Partial<ProjectContinueDeps>
): Promise<ContinueProjectResult> {
  const hasCompleteProvidedDeps =
    !!providedDeps?.projectRepository &&
    !!providedDeps?.workflowRunRepository &&
    !!providedDeps?.decisionRecoveryRepository;
  const deps = (
    hasCompleteProvidedDeps
      ? providedDeps
      : {
          ...(await getDefaultDeps()),
          ...providedDeps
        }
  ) satisfies ProjectContinueDeps;

  const detail = await deps.projectRepository.getProjectDecisionAndPublishingDetail(projectId);
  const activeWorkflowRun = await deps.workflowRunRepository.findLatestActiveRun(projectId);
  const pendingRecoveryTask = await deps.decisionRecoveryRepository.findLatestPendingTask(projectId);
  const productionStatus = buildProductionStatus({
    detail,
    activeWorkflowRun,
    pendingRecoveryTask
  });

  if (!productionStatus.canContinue) {
    return {
      projectId,
      continued: false,
      action: productionStatus.recommendedAction,
      reason: productionStatus.reason,
      workflowRunId: null,
      flowName: null,
      autoContinuedChapters: 0
    };
  }

  if (productionStatus.recommendedAction === 'run_replan_recovery' && pendingRecoveryTask) {
    const queued = await queueProjectFlow({
      projectId,
      flow: chapterReplanFlow(),
      chapterNumber: pendingRecoveryTask.resumeFromChapter,
      workflowRunRepository: deps.workflowRunRepository
    });

    return {
      projectId,
      continued: true,
      action: 'run_replan_recovery',
      reason: productionStatus.reason,
      autoContinuedChapters: 0,
      ...queued
    };
  }

  if (productionStatus.recommendedAction === 'generate_outline') {
    const queued = await queueProjectFlow({
      projectId,
      flow: generateOutlineFlow(),
      chapterNumber: null,
      workflowRunRepository: deps.workflowRunRepository
    });

    return {
      projectId,
      continued: true,
      action: 'generate_outline',
      reason: productionStatus.reason,
      autoContinuedChapters: 0,
      ...queued
    };
  }

  if (productionStatus.recommendedAction === 'generate_volume') {
    const queued = await queueProjectFlow({
      projectId,
      flow: generateVolumeFlow(),
      chapterNumber: null,
      workflowRunRepository: deps.workflowRunRepository
    });

    return {
      projectId,
      continued: true,
      action: 'generate_volume',
      reason: productionStatus.reason,
      autoContinuedChapters: 0,
      ...queued
    };
  }

  if (productionStatus.recommendedAction === 'generate_next_chapter') {
    const queued = await queueProjectFlow({
      projectId,
      flow: generateChapterFlow(),
      chapterNumber: null,
      workflowRunRepository: deps.workflowRunRepository
    });

    return {
      projectId,
      continued: true,
      action: 'generate_next_chapter',
      reason: productionStatus.reason,
      autoContinuedChapters: 0,
      ...queued
    };
  }

  return {
    projectId,
    continued: false,
    action: 'none',
    reason: productionStatus.reason,
    workflowRunId: null,
    flowName: null,
    autoContinuedChapters: 0
  };
}
