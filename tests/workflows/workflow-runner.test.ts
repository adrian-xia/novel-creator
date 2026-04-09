import { describe, expect, it, vi } from 'vitest';

const createRun = vi.fn();
const markStepRunning = vi.fn();
const markStepSucceeded = vi.fn();
const markStepFailed = vi.fn();
const markRunSucceeded = vi.fn();
const markRunFailed = vi.fn();

vi.mock('../../packages/storage/src/repositories/workflow-run-repository', () => ({
  WorkflowRunRepository: class {
    createRun = createRun;
    markStepRunning = markStepRunning;
    markStepSucceeded = markStepSucceeded;
    markStepFailed = markStepFailed;
    markRunSucceeded = markRunSucceeded;
    markRunFailed = markRunFailed;
  }
}));

describe('runInstrumentedWorkflow', () => {
  it('marks the failing step and workflow run when a step throws', async () => {
    createRun.mockResolvedValue({ id: 'workflow-run-1' });

    const { runInstrumentedWorkflow } = await import('../../packages/workflows/src/workflow-runner');

    await expect(
      runInstrumentedWorkflow({
        flow: {
          name: 'generate-outline-flow',
          buildInitialContext: (payload) => payload,
          steps: [
            { name: 'step-a', run: async (context: any) => context },
            { name: 'step-b', run: async () => { throw new Error('boom'); } }
          ]
        },
        payload: { projectId: 'project-1', chapterNumber: null },
        deps: {}
      })
    ).rejects.toThrow('boom');

    expect(markStepFailed).toHaveBeenCalledWith('workflow-run-1', 'step-b', 'boom');
    expect(markRunFailed).toHaveBeenCalledWith('workflow-run-1', 'boom');
  });
});
