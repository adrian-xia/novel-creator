import { describe, expect, it, vi } from 'vitest';

describe('chapter replan executors', () => {
  it('loads the latest pending recovery task, rewinds story state, and enqueues chapter regeneration', async () => {
    const { executeChapterReplan } = await import(
      '../../packages/workflows/src/chapter-replan-executors'
    );
    const deps = {
      decisionRecoveryRepository: {
        findLatestPendingTask: vi.fn().mockResolvedValue({
          id: 'recovery-task-1',
          projectId: 'project-1',
          sessionId: 'session-1',
          startChapter: 8,
          endChapter: 10,
          resumeFromChapter: 9,
          status: 'pending'
        }),
        markTaskRunning: vi.fn().mockResolvedValue(undefined),
        markTaskCompleted: vi.fn().mockResolvedValue(undefined)
      },
      storyStateRepository: {
        invalidateChapterPlansInRange: vi.fn().mockResolvedValue({ count: 3 }),
        markChaptersNeedsReplan: vi.fn().mockResolvedValue([]),
        rewindStoryStateToChapter: vi.fn().mockResolvedValue(undefined)
      },
      workflowRunRepository: {
        createRun: vi.fn().mockResolvedValue({
          id: 'workflow-run-1',
          flowName: 'generate-chapter-flow',
          projectId: 'project-1',
          chapterNumber: 9,
          status: 'queued'
        })
      }
    };

    await expect(
      executeChapterReplan(
        { projectId: 'project-1', chapterNumber: null },
        deps as never
      )
    ).resolves.toEqual(
      expect.objectContaining({
        chapterNumber: 9,
        recoveryTask: expect.objectContaining({
          id: 'recovery-task-1'
        }),
        enqueuedRunId: 'workflow-run-1'
      })
    );

    expect(deps.decisionRecoveryRepository.markTaskRunning).toHaveBeenCalledWith('recovery-task-1');
    expect(deps.storyStateRepository.invalidateChapterPlansInRange).toHaveBeenCalledWith({
      projectId: 'project-1',
      startChapter: 8,
      endChapter: 10
    });
    expect(deps.storyStateRepository.markChaptersNeedsReplan).toHaveBeenCalledWith({
      projectId: 'project-1',
      startChapter: 8,
      endChapter: 10
    });
    expect(deps.storyStateRepository.rewindStoryStateToChapter).toHaveBeenCalledWith({
      projectId: 'project-1',
      resumeFromChapter: 9
    });
    expect(deps.workflowRunRepository.createRun).toHaveBeenCalledWith({
      flowName: 'generate-chapter-flow',
      projectId: 'project-1',
      chapterNumber: 9
    });
    expect(deps.decisionRecoveryRepository.markTaskCompleted).toHaveBeenCalledWith(
      'recovery-task-1'
    );
  });

  it('fails when there is no pending recovery task for the project', async () => {
    const { executeChapterReplan } = await import(
      '../../packages/workflows/src/chapter-replan-executors'
    );

    await expect(
      executeChapterReplan(
        { projectId: 'project-1', chapterNumber: null },
        {
          decisionRecoveryRepository: {
            findLatestPendingTask: vi.fn().mockResolvedValue(null),
            markTaskRunning: vi.fn(),
            markTaskCompleted: vi.fn()
          },
          storyStateRepository: {
            invalidateChapterPlansInRange: vi.fn(),
            markChaptersNeedsReplan: vi.fn(),
            rewindStoryStateToChapter: vi.fn()
          },
          workflowRunRepository: {
            createRun: vi.fn()
          }
        } as never
      )
    ).rejects.toThrow('No pending chapter recovery task found for project-1');
  });
});
