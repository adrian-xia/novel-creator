import { describe, expect, it, vi } from 'vitest';

const createRun = vi.fn();
const markStepRunning = vi.fn();
const markStepSucceeded = vi.fn();
const markRunSucceeded = vi.fn();

vi.mock('../../packages/storage/src/repositories/workflow-run-repository', () => ({
  WorkflowRunRepository: class {
    createRun = createRun;
    markStepRunning = markStepRunning;
    markStepSucceeded = markStepSucceeded;
    markRunSucceeded = markRunSucceeded;
  }
}));

describe('runInstrumentedWorkflow', () => {
  it('creates a workflow run and step runs around the provided definition', async () => {
    createRun.mockResolvedValue({
      id: 'workflow-run-1',
      flowName: 'decision-session-flow',
      projectId: 'project-1',
      chapterNumber: 5,
      status: 'queued'
    });
    markStepRunning.mockResolvedValue(undefined);
    markStepSucceeded.mockResolvedValue(undefined);
    markRunSucceeded.mockResolvedValue(undefined);

    const { runInstrumentedWorkflow } = await import(
      '../../packages/workflows/src/workflow-runner'
    );

    const result = await runInstrumentedWorkflow({
      flow: {
        name: 'decision-session-flow',
        steps: ['step-a', 'step-b']
      },
      payload: {
        projectId: 'project-1',
        chapterNumber: 5
      }
    });

    expect(result.flowName).toBe('decision-session-flow');
    expect(result.stepCount).toBe(2);
    expect(createRun).toHaveBeenCalledWith({
      flowName: 'decision-session-flow',
      projectId: 'project-1',
      chapterNumber: 5
    });
    expect(markStepRunning).toHaveBeenCalledTimes(2);
    expect(markStepSucceeded).toHaveBeenCalledTimes(2);
    expect(markRunSucceeded).toHaveBeenCalledWith('workflow-run-1');
  });
});
