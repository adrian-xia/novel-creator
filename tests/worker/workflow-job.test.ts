import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runInstrumentedWorkflow } = vi.hoisted(() => ({
  runInstrumentedWorkflow: vi.fn()
}));

const { createProductionWorkflowDeps } = vi.hoisted(() => ({
  createProductionWorkflowDeps: vi.fn()
}));

const productionDeps = {
  promptRepository: { name: 'prompt-repository' },
  projectRepository: { name: 'project-repository' },
  storyStateRepository: { name: 'story-state-repository' },
  decisionSessionRepository: {
    name: 'decision-session-repository',
    listSessions: vi.fn()
  },
  decisionRecoveryRepository: {
    name: 'decision-recovery-repository',
    findLatestPendingTask: vi.fn()
  },
  workflowRunRepository: {
    name: 'workflow-run-repository',
    findLatestActiveRun: vi.fn()
  },
  agentRunner: { run: vi.fn() },
  defaultProvider: 'openai',
  defaultModel: 'gpt-5.4'
};

vi.mock('../../packages/workflows/src', async () => {
  const actual = await vi.importActual<typeof import('../../packages/workflows/src')>(
    '../../packages/workflows/src'
  );

  return actual;
});

vi.mock('../../packages/workflows/src/production-deps', () => {
  return {
    createProductionWorkflowDeps
  };
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
    createProductionWorkflowDeps.mockReset();
    createProductionWorkflowDeps.mockReturnValue(productionDeps);
    productionDeps.decisionSessionRepository.listSessions.mockReset();
    productionDeps.decisionRecoveryRepository.findLatestPendingTask.mockReset();
    productionDeps.workflowRunRepository.findLatestActiveRun.mockReset();
    productionDeps.decisionSessionRepository.listSessions.mockResolvedValue([]);
    productionDeps.decisionRecoveryRepository.findLatestPendingTask.mockResolvedValue(null);
    productionDeps.workflowRunRepository.findLatestActiveRun.mockResolvedValue(null);
  });

  const expectWorkflowDeps = (deps: unknown) => {
    expect(deps).toBe(productionDeps);
    expect(createProductionWorkflowDeps).toHaveBeenCalledTimes(1);
  };

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
    expectWorkflowDeps(decisionSessionCall?.deps);
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
    expectWorkflowDeps(replanCall?.deps);
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
    expectWorkflowDeps(publishCall?.deps);
  });

  it('passes real workflow dependencies into runInstrumentedWorkflow', async () => {
    runInstrumentedWorkflow.mockResolvedValue({
      flowName: 'generate-outline-flow',
      stepCount: 8
    });

    await runWorkflowJob('generate-outline-flow', { projectId: 'project-1' });

    expect(runInstrumentedWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        deps: productionDeps
      })
    );
    expect(createProductionWorkflowDeps).toHaveBeenCalledTimes(1);
  });

  it('auto-continues one additional chapter after an approved chapter flow when budget is available', async () => {
    runInstrumentedWorkflow
      .mockResolvedValueOnce({
        projectId: 'project-1',
        chapterNumber: 8,
        reviewDecision: 'approve'
      })
      .mockResolvedValueOnce({
        projectId: 'project-1',
        chapterNumber: 9,
        reviewDecision: 'approve'
      });

    await expect(
      runWorkflowJob('generate-chapter-flow', {
        projectId: 'project-1',
        autoContinueBudget: 1
      })
    ).resolves.toEqual({
      projectId: 'project-1',
      chapterNumber: 8,
      reviewDecision: 'approve',
      autoContinuedChapters: 1
    });

    expect(runInstrumentedWorkflow).toHaveBeenCalledTimes(2);
    expect(runInstrumentedWorkflow.mock.calls[0]?.[0]?.flow.name).toBe('generate-chapter-flow');
    expect(runInstrumentedWorkflow.mock.calls[1]?.[0]?.flow.name).toBe('generate-chapter-flow');
    expect(runInstrumentedWorkflow.mock.calls[1]?.[0]?.payload).toEqual({
      projectId: 'project-1',
      chapterNumber: null
    });
  });

  it('does not auto-continue when the chapter flow does not finish approved', async () => {
    runInstrumentedWorkflow.mockResolvedValue({
      projectId: 'project-1',
      chapterNumber: 8,
      reviewDecision: 'blocked_for_manual_decision'
    });

    await expect(
      runWorkflowJob('generate-chapter-flow', {
        projectId: 'project-1',
        autoContinueBudget: 1
      })
    ).resolves.toEqual({
      projectId: 'project-1',
      chapterNumber: 8,
      reviewDecision: 'blocked_for_manual_decision',
      autoContinuedChapters: 0
    });

    expect(runInstrumentedWorkflow).toHaveBeenCalledTimes(1);
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
