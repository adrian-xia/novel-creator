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

    const decisionSessionCall = runInstrumentedWorkflow.mock.calls[0]?.[0];

    expect(decisionSessionCall?.flow.name).toBe('decision-session-flow');
    expect(
      decisionSessionCall?.flow.steps.map((step: { name: string }) => step.name)
    ).toEqual([
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
    ]);
    expect(decisionSessionCall?.payload).toEqual({
      projectId: 'project-1',
      chapterNumber: 5
    });
    expect(decisionSessionCall?.deps).toEqual({});
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

    const replanCall = runInstrumentedWorkflow.mock.calls[0]?.[0];

    expect(replanCall?.flow.name).toBe('chapter-replan-flow');
    expect(replanCall?.flow.steps.map((step: { name: string }) => step.name)).toEqual([
      'load-recovery-task',
      'invalidate-plans-in-window',
      'set-chapters-needs-replan',
      'enqueue-replan-window',
      'mark-recovery-task-complete'
    ]);
    expect(replanCall?.payload).toEqual({
      projectId: 'project-2',
      chapterNumber: 8
    });
    expect(replanCall?.deps).toEqual({});
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

    const publishCall = runInstrumentedWorkflow.mock.calls[0]?.[0];

    expect(publishCall?.flow.name).toBe('publish-chapter-flow');
    expect(publishCall?.flow.steps.map((step: { name: string }) => step.name)).toEqual([
      'load-publish-profile',
      'expand-publish-tasks',
      'run-adapter-publishes',
      'run-manual-exports',
      'persist-publish-results'
    ]);
    expect(publishCall?.payload).toEqual({
      projectId: 'project-1',
      chapterNumber: 7
    });
    expect(publishCall?.deps).toEqual({});
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
