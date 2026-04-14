import { describe, expect, it, vi } from 'vitest';

function buildDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-1',
    storyState: {
      outline: null,
      volumePlans: [],
      currentPosition: {
        nextChapterNumber: 1,
        currentVolumeNumber: null
      }
    },
    chapterStateRecords: [],
    reviewOutcomeRecords: [],
    agentRunRecords: [],
    publishProfile: null,
    publishTaskRecords: [],
    decisionSessions: [],
    ...overrides
  };
}

describe('project continue', () => {
  it('computes a needs-outline production status when the project has no outline yet', async () => {
    const { buildProductionStatus } = await import('../../packages/workflows/src/project-continue');

    const status = buildProductionStatus({
      detail: buildDetail(),
      activeWorkflowRun: null,
      pendingRecoveryTask: null
    });

    expect(status).toEqual({
      phase: 'needs_outline',
      canContinue: true,
      recommendedAction: 'generate_outline',
      reason: 'Project does not have an outline yet.',
      activeWorkflowRunId: null,
      openSessionId: null,
      pendingRecoveryTaskId: null,
      nextChapterNumber: 1,
      autoContinueBudget: 1
    });
  });

  it('returns an open-human-gate recommendation when outline confirmation is still open', async () => {
    const { continueProject } = await import('../../packages/workflows/src/project-continue');

    const result = await continueProject('project-1', {
      projectRepository: {
        getProjectDecisionAndPublishingDetail: vi.fn().mockResolvedValue(
          buildDetail({
            storyState: {
              outline: { title: '总纲' },
              volumePlans: [],
              currentPosition: {
                nextChapterNumber: 1,
                currentVolumeNumber: null
              }
            },
            decisionSessions: [
              {
                id: 'session-1',
                gateType: 'outline_confirmation',
                status: 'open',
                selectedOptionId: null
              }
            ]
          })
        )
      },
      workflowRunRepository: {
        findLatestActiveRun: vi.fn().mockResolvedValue(null),
        createRun: vi.fn()
      },
      decisionRecoveryRepository: {
        findLatestPendingTask: vi.fn().mockResolvedValue(null)
      }
    });

    expect(result).toEqual({
      projectId: 'project-1',
      continued: false,
      action: 'open_human_gate',
      reason: 'Project is waiting for outline confirmation.',
      workflowRunId: null,
      flowName: null,
      autoContinuedChapters: 0
    });
  });

  it('queues outline generation when continue is called before any outline exists', async () => {
    const createRun = vi.fn().mockResolvedValue({ id: 'workflow-run-1' });
    const { continueProject } = await import('../../packages/workflows/src/project-continue');

    const result = await continueProject('project-1', {
      projectRepository: {
        getProjectDecisionAndPublishingDetail: vi.fn().mockResolvedValue(buildDetail())
      },
      workflowRunRepository: {
        findLatestActiveRun: vi.fn().mockResolvedValue(null),
        createRun
      },
      decisionRecoveryRepository: {
        findLatestPendingTask: vi.fn().mockResolvedValue(null)
      }
    });

    expect(createRun).toHaveBeenCalledWith({
      flowName: 'generate-outline-flow',
      projectId: 'project-1',
      chapterNumber: null
    });
    expect(result).toEqual({
      projectId: 'project-1',
      continued: true,
      action: 'generate_outline',
      reason: 'Project does not have an outline yet.',
      workflowRunId: 'workflow-run-1',
      flowName: 'generate-outline-flow',
      autoContinuedChapters: 0,
      status: 'queued',
      steps: [
        'load-project-input',
        'load-outline-prompt',
        'run-outline-agent',
        'validate-outline-output',
        'persist-outline'
      ]
    });
  });

  it('queues volume generation once outline exists and no volume plans have been confirmed', async () => {
    const createRun = vi.fn().mockResolvedValue({ id: 'workflow-run-2' });
    const { continueProject } = await import('../../packages/workflows/src/project-continue');

    const result = await continueProject('project-1', {
      projectRepository: {
        getProjectDecisionAndPublishingDetail: vi.fn().mockResolvedValue(
          buildDetail({
            storyState: {
              outline: { title: '总纲' },
              volumePlans: [],
              currentPosition: {
                nextChapterNumber: 1,
                currentVolumeNumber: null
              }
            },
            decisionSessions: [
              {
                id: 'session-outline',
                gateType: 'outline_confirmation',
                status: 'resolved',
                selectedOptionId: 'accept-outline'
              }
            ]
          })
        )
      },
      workflowRunRepository: {
        findLatestActiveRun: vi.fn().mockResolvedValue(null),
        createRun
      },
      decisionRecoveryRepository: {
        findLatestPendingTask: vi.fn().mockResolvedValue(null)
      }
    });

    expect(createRun).toHaveBeenCalledWith({
      flowName: 'generate-volume-flow',
      projectId: 'project-1',
      chapterNumber: null
    });
    expect(result.flowName).toBe('generate-volume-flow');
    expect(result.action).toBe('generate_volume');
  });

  it('queues chapter replan recovery before any other continuation action', async () => {
    const createRun = vi.fn().mockResolvedValue({ id: 'workflow-run-3' });
    const { continueProject } = await import('../../packages/workflows/src/project-continue');

    const result = await continueProject('project-1', {
      projectRepository: {
        getProjectDecisionAndPublishingDetail: vi.fn().mockResolvedValue(
          buildDetail({
            storyState: {
              outline: { title: '总纲' },
              volumePlans: [{ volumeNumber: 1, title: '第一卷' }],
              currentPosition: {
                nextChapterNumber: 9,
                currentVolumeNumber: 1
              }
            }
          })
        )
      },
      workflowRunRepository: {
        findLatestActiveRun: vi.fn().mockResolvedValue(null),
        createRun
      },
      decisionRecoveryRepository: {
        findLatestPendingTask: vi.fn().mockResolvedValue({
          id: 'recovery-1',
          resumeFromChapter: 8
        })
      }
    });

    expect(createRun).toHaveBeenCalledWith({
      flowName: 'chapter-replan-flow',
      projectId: 'project-1',
      chapterNumber: 8
    });
    expect(result.action).toBe('run_replan_recovery');
    expect(result.flowName).toBe('chapter-replan-flow');
  });

  it('queues next chapter generation when outline and volume plans are ready with no blockers', async () => {
    const createRun = vi.fn().mockResolvedValue({ id: 'workflow-run-4' });
    const { continueProject } = await import('../../packages/workflows/src/project-continue');

    const result = await continueProject('project-1', {
      projectRepository: {
        getProjectDecisionAndPublishingDetail: vi.fn().mockResolvedValue(
          buildDetail({
            storyState: {
              outline: { title: '总纲' },
              volumePlans: [{ volumeNumber: 1, title: '第一卷' }],
              currentPosition: {
                nextChapterNumber: 9,
                currentVolumeNumber: 1
              }
            },
            decisionSessions: [
              {
                id: 'session-volume',
                gateType: 'volume_confirmation',
                status: 'resolved',
                selectedOptionId: 'accept-volume-plans'
              }
            ]
          })
        )
      },
      workflowRunRepository: {
        findLatestActiveRun: vi.fn().mockResolvedValue(null),
        createRun
      },
      decisionRecoveryRepository: {
        findLatestPendingTask: vi.fn().mockResolvedValue(null)
      }
    });

    expect(createRun).toHaveBeenCalledWith({
      flowName: 'generate-chapter-flow',
      projectId: 'project-1',
      chapterNumber: null
    });
    expect(result.action).toBe('generate_next_chapter');
    expect(result.flowName).toBe('generate-chapter-flow');
  });

  it('treats persisted volume plans as chapter-ready even when outline snapshot is missing', async () => {
    const { buildProductionStatus } = await import('../../packages/workflows/src/project-continue');

    const status = buildProductionStatus({
      detail: buildDetail({
        storyState: {
          outline: null,
          volumePlans: [{ volumeNumber: 1, title: '第一卷' }],
          currentPosition: {
            nextChapterNumber: 3,
            currentVolumeNumber: 1
          }
        },
        chapterStateRecords: [
          {
            chapterNumber: 1,
            status: 'approved'
          },
          {
            chapterNumber: 2,
            status: 'approved'
          }
        ]
      }),
      activeWorkflowRun: null,
      pendingRecoveryTask: null
    });

    expect(status).toEqual({
      phase: 'needs_chapter_generation',
      canContinue: true,
      recommendedAction: 'generate_next_chapter',
      reason: 'Project is ready to generate the next chapter.',
      activeWorkflowRunId: null,
      openSessionId: null,
      pendingRecoveryTaskId: null,
      nextChapterNumber: 3,
      autoContinueBudget: 1
    });
  });

  it('refuses to continue while another queued or running workflow already exists', async () => {
    const createRun = vi.fn();
    const { continueProject } = await import('../../packages/workflows/src/project-continue');

    const result = await continueProject('project-1', {
      projectRepository: {
        getProjectDecisionAndPublishingDetail: vi.fn().mockResolvedValue(
          buildDetail({
            storyState: {
              outline: { title: '总纲' },
              volumePlans: [{ volumeNumber: 1, title: '第一卷' }],
              currentPosition: {
                nextChapterNumber: 9,
                currentVolumeNumber: 1
              }
            }
          })
        )
      },
      workflowRunRepository: {
        findLatestActiveRun: vi.fn().mockResolvedValue({
          id: 'workflow-run-active',
          status: 'running'
        }),
        createRun
      },
      decisionRecoveryRepository: {
        findLatestPendingTask: vi.fn().mockResolvedValue(null)
      }
    });

    expect(createRun).not.toHaveBeenCalled();
    expect(result).toEqual({
      projectId: 'project-1',
      continued: false,
      action: 'wait_for_running_workflow',
      reason: 'Project already has an active workflow run in progress.',
      workflowRunId: null,
      flowName: null,
      autoContinuedChapters: 0
    });
  });
});
