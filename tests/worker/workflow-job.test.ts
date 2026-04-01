import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runInstrumentedWorkflow } = vi.hoisted(() => ({
  runInstrumentedWorkflow: vi.fn()
}));

vi.mock('../../packages/workflows/src', async () => {
  const actual = await vi.importActual<typeof import('../../packages/workflows/src')>(
    '../../packages/workflows/src'
  );

  return {
    ...actual,
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
      stepCount: 6
    });

    await expect(
      runWorkflowJob('decision-session-flow', {
        projectId: 'project-1',
        chapterNumber: 5
      })
    ).resolves.toEqual({
      flowName: 'decision-session-flow',
      stepCount: 6
    });

    expect(runInstrumentedWorkflow).toHaveBeenCalledWith({
      flow: {
        name: 'decision-session-flow',
        steps: [
          'load-blocked-review',
          'build-decision-packet',
          'create-decision-session',
          'await-human-and-assistant-conversation',
          'persist-decision-resolution',
          'apply-resolution'
        ]
      },
      payload: {
        projectId: 'project-1',
        chapterNumber: 5
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
});
