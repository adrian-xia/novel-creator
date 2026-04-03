import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runInstrumentedWorkflow } = vi.hoisted(() => ({
  runInstrumentedWorkflow: vi.fn()
}));

vi.mock('../../packages/workflows/src', async () => {
  const actual = await vi.importActual<typeof import('../../packages/workflows/src')>(
    '../../packages/workflows/src'
  );

  return actual;
});

vi.mock('../../packages/workflows/src/workflow-runner', () => {
  return {
    runInstrumentedWorkflow
  };
});

import { runWorkflowJob } from '../../apps/worker/src/jobs/workflow-job';

describe('runWorkflowJob', () => {
  beforeEach(() => {
    runInstrumentedWorkflow.mockReset();
  });

  it('dispatches the decision-session workflow', async () => {
    runInstrumentedWorkflow.mockResolvedValue({
      flowName: 'decision-session-flow',
      stepCount: 10
    });

    await expect(
      runWorkflowJob('decision-session-flow', {
        projectId: 'project-1',
        chapterNumber: 5
      })
    ).resolves.toEqual({
      flowName: 'decision-session-flow',
      stepCount: 10
    });

    expect(runInstrumentedWorkflow).toHaveBeenCalledWith({
      flow: {
        name: 'decision-session-flow',
        steps: [
          'append-human-message',
          'load-decision-context',
          'assemble-decision-conversation-context',
          'run-decision-assistant',
          'persist-assistant-message',
          'generate-resolution-draft',
          'persist-resolution',
          'apply-resolution',
          'invalidate-plans-in-window',
          'enqueue-replan-window'
        ]
      },
      payload: {
        projectId: 'project-1',
        chapterNumber: 5
      }
    });
  });

  it('dispatches the chapter-replan workflow', async () => {
    runInstrumentedWorkflow.mockResolvedValue({
      flowName: 'chapter-replan-flow',
      stepCount: 5
    });

    await expect(
      runWorkflowJob('chapter-replan-flow', {
        projectId: 'project-2',
        chapterNumber: 8
      })
    ).resolves.toEqual({
      flowName: 'chapter-replan-flow',
      stepCount: 5
    });

    expect(runInstrumentedWorkflow).toHaveBeenCalledWith({
      flow: {
        name: 'chapter-replan-flow',
        steps: [
          'load-recovery-task',
          'invalidate-plans-in-window',
          'set-chapters-needs-replan',
          'enqueue-replan-window',
          'mark-recovery-task-complete'
        ]
      },
      payload: {
        projectId: 'project-2',
        chapterNumber: 8
      }
    });
  });

  it('dispatches the publish-chapter workflow', async () => {
    runInstrumentedWorkflow.mockResolvedValue({
      flowName: 'publish-chapter-flow',
      stepCount: 5
    });

    await expect(
      runWorkflowJob('publish-chapter-flow', {
        projectId: 'project-1',
        chapterNumber: 7
      })
    ).resolves.toEqual({
      flowName: 'publish-chapter-flow',
      stepCount: 5
    });

    expect(runInstrumentedWorkflow).toHaveBeenCalledWith({
      flow: {
        name: 'publish-chapter-flow',
        steps: [
          'load-publish-profile',
          'expand-publish-tasks',
          'run-adapter-publishes',
          'run-manual-exports',
          'persist-publish-results'
        ]
      },
      payload: {
        projectId: 'project-1',
        chapterNumber: 7
      }
    });
  });

  it('rejects unknown workflows instead of running an empty flow', async () => {
    await expect(
      runWorkflowJob('unknown-workflow', {
        projectId: 'project-1'
      })
    ).rejects.toThrow('Unknown workflow job: unknown-workflow');

    expect(runInstrumentedWorkflow).not.toHaveBeenCalled();
  });
});
