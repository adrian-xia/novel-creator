import { generateChapterFlow } from './generate-chapter-flow';
import type { ChapterReplanFlowContext } from './chapter-replan-flow';

interface ChapterRecoveryTaskRecord {
  id: string;
  projectId: string;
  sessionId: string;
  startChapter: number;
  endChapter: number;
  resumeFromChapter: number;
  status: string;
}

interface ChapterReplanWorkflowDeps {
  decisionRecoveryRepository: {
    findLatestPendingTask(projectId: string): Promise<ChapterRecoveryTaskRecord | null>;
    markTaskRunning(taskId: string): Promise<unknown>;
    markTaskCompleted(taskId: string): Promise<unknown>;
  };
  storyStateRepository: {
    invalidateChapterPlansInRange(input: {
      projectId: string;
      startChapter: number;
      endChapter: number;
    }): Promise<unknown>;
    markChaptersNeedsReplan(input: {
      projectId: string;
      startChapter: number;
      endChapter: number;
    }): Promise<unknown>;
    rewindStoryStateToChapter(input: {
      projectId: string;
      resumeFromChapter: number;
    }): Promise<unknown>;
  };
  workflowRunRepository: {
    createRun(input: {
      flowName: string;
      projectId: string;
      chapterNumber: number | null;
    }): Promise<{ id: string }>;
  };
}

function requireRecoveryTask(
  task: ChapterRecoveryTaskRecord | null,
  projectId: string
): ChapterRecoveryTaskRecord {
  if (!task) {
    throw new Error(`No pending chapter recovery task found for ${projectId}`);
  }

  return task;
}

export async function executeChapterReplan(
  context: ChapterReplanFlowContext,
  deps: ChapterReplanWorkflowDeps
): Promise<
  ChapterReplanFlowContext & {
    recoveryTask: ChapterRecoveryTaskRecord;
    enqueuedRunId: string;
  }
> {
  const recoveryTask = requireRecoveryTask(
    await deps.decisionRecoveryRepository.findLatestPendingTask(context.projectId),
    context.projectId
  );

  await deps.decisionRecoveryRepository.markTaskRunning(recoveryTask.id);
  await deps.storyStateRepository.invalidateChapterPlansInRange({
    projectId: recoveryTask.projectId,
    startChapter: recoveryTask.startChapter,
    endChapter: recoveryTask.endChapter
  });
  await deps.storyStateRepository.markChaptersNeedsReplan({
    projectId: recoveryTask.projectId,
    startChapter: recoveryTask.startChapter,
    endChapter: recoveryTask.endChapter
  });
  await deps.storyStateRepository.rewindStoryStateToChapter({
    projectId: recoveryTask.projectId,
    resumeFromChapter: recoveryTask.resumeFromChapter
  });

  const enqueuedRun = await deps.workflowRunRepository.createRun({
    flowName: generateChapterFlow().name,
    projectId: recoveryTask.projectId,
    chapterNumber: recoveryTask.resumeFromChapter
  });

  await deps.decisionRecoveryRepository.markTaskCompleted(recoveryTask.id);

  return {
    ...context,
    chapterNumber: recoveryTask.resumeFromChapter,
    recoveryTask,
    enqueuedRunId: enqueuedRun.id
  };
}
