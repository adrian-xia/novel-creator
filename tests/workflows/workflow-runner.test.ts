import { beforeEach, describe, expect, it, vi } from 'vitest';

const createRun = vi.fn();
const markStepRunning = vi.fn();
const markStepSucceeded = vi.fn();
const markStepFailed = vi.fn();
const markRunSucceeded = vi.fn();
const markRunFailed = vi.fn();
const markRunWaitingForHumanGate = vi.fn();

vi.mock('../../packages/storage/src/repositories/workflow-run-repository', () => ({
  WorkflowRunRepository: class {
    createRun = createRun;
    markStepRunning = markStepRunning;
    markStepSucceeded = markStepSucceeded;
    markStepFailed = markStepFailed;
    markRunSucceeded = markRunSucceeded;
    markRunFailed = markRunFailed;
    markRunWaitingForHumanGate = markRunWaitingForHumanGate;
  }
}));

describe('runInstrumentedWorkflow', () => {
  beforeEach(() => {
    createRun.mockReset();
    markStepRunning.mockReset();
    markStepSucceeded.mockReset();
    markStepFailed.mockReset();
    markRunSucceeded.mockReset();
    markRunFailed.mockReset();
    markRunWaitingForHumanGate.mockReset();
  });

  it('executes steps in order and marks the run succeeded', async () => {
    createRun.mockResolvedValue({ id: 'workflow-run-1' });
    markStepRunning.mockResolvedValue(undefined);
    markStepSucceeded.mockResolvedValue(undefined);
    markRunSucceeded.mockResolvedValue(undefined);

    const { runInstrumentedWorkflow } = await import('../../packages/workflows/src/workflow-runner');

    const result = await runInstrumentedWorkflow({
      flow: {
        name: 'generate-outline-flow',
        buildInitialContext: (payload) => ({ ...payload, history: [] as string[] }),
        steps: [
          {
            name: 'step-a',
            run: async (context) => ({
              ...context,
              history: [...context.history, 'step-a']
            })
          },
          {
            name: 'step-b',
            run: async (context) => ({
              ...context,
              history: [...context.history, 'step-b']
            })
          }
        ]
      },
      payload: { projectId: 'project-1', chapterNumber: null },
      deps: {}
    });

    expect(result.history).toEqual(['step-a', 'step-b']);
    expect(markStepRunning.mock.calls.map((call) => call[1])).toEqual(['step-a', 'step-b']);
    expect(markStepSucceeded.mock.calls.map((call) => call[1])).toEqual(['step-a', 'step-b']);
    expect(markRunSucceeded).toHaveBeenCalledWith('workflow-run-1');
    expect(markRunFailed).not.toHaveBeenCalled();
  });

  it('marks the failing step and workflow run when a step throws', async () => {
    createRun.mockResolvedValue({ id: 'workflow-run-2' });

    const { runInstrumentedWorkflow } = await import('../../packages/workflows/src/workflow-runner');

    await expect(
      runInstrumentedWorkflow({
        flow: {
          name: 'generate-outline-flow',
          buildInitialContext: (payload) => payload,
          steps: [
            { name: 'step-a', run: async (context: any) => context },
            {
              name: 'step-b',
              run: async () => {
                throw new Error('boom');
              }
            }
          ]
        },
        payload: { projectId: 'project-1', chapterNumber: null },
        deps: {}
      })
    ).rejects.toThrow('boom');

    expect(markStepFailed).toHaveBeenCalledWith('workflow-run-2', 'step-b', 'boom');
    expect(markRunFailed).toHaveBeenCalledWith('workflow-run-2', 'boom');
  });

  it('marks the workflow run failed when buildInitialContext throws', async () => {
    createRun.mockResolvedValue({ id: 'workflow-run-3' });

    const { runInstrumentedWorkflow } = await import('../../packages/workflows/src/workflow-runner');

    await expect(
      runInstrumentedWorkflow({
        flow: {
          name: 'generate-outline-flow',
          buildInitialContext: () => {
            throw new Error('no-context');
          },
          steps: [{ name: 'step-a', run: async (context: any) => context }]
        },
        payload: { projectId: 'project-1', chapterNumber: null },
        deps: {}
      })
    ).rejects.toThrow('no-context');

    expect(markRunFailed).toHaveBeenCalledWith('workflow-run-3', 'no-context');
    expect(markStepRunning).not.toHaveBeenCalled();
    expect(markStepFailed).not.toHaveBeenCalled();
  });

  it('marks the workflow run as waiting_for_human_gate when a step requests confirmation', async () => {
    createRun.mockResolvedValue({ id: 'workflow-run-4' });

    const { requestHumanGate } = await import('../../packages/workflows/src/human-gate');
    const { runInstrumentedWorkflow } = await import('../../packages/workflows/src/workflow-runner');

    await expect(
      runInstrumentedWorkflow({
        flow: {
          name: 'generate-outline-flow',
          buildInitialContext: (payload) => payload,
          steps: [
            {
              name: 'pause-for-outline-confirmation',
              run: async () => requestHumanGate('session-123')
            }
          ]
        },
        payload: { projectId: 'project-1', chapterNumber: null },
        deps: {} as any
      })
    ).resolves.toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        chapterNumber: null,
        waitingForHumanGate: 'session-123'
      })
    );

    expect(markStepSucceeded).toHaveBeenCalledWith(
      'workflow-run-4',
      'pause-for-outline-confirmation'
    );
    expect(markRunWaitingForHumanGate).toHaveBeenCalledWith(
      'workflow-run-4',
      'session-123'
    );
    expect(markStepFailed).not.toHaveBeenCalled();
    expect(markRunFailed).not.toHaveBeenCalled();
    expect(markRunSucceeded).not.toHaveBeenCalled();
  });

  it('returns context attached to a human gate pause when the step computed new state', async () => {
    createRun.mockResolvedValue({ id: 'workflow-run-5' });

    const { requestHumanGate } = await import('../../packages/workflows/src/human-gate');
    const { runInstrumentedWorkflow } = await import('../../packages/workflows/src/workflow-runner');

    await expect(
      runInstrumentedWorkflow({
        flow: {
          name: 'generate-outline-flow',
          buildInitialContext: (payload) => ({ ...payload, draftOutlineVersion: 0 }),
          steps: [
            {
              name: 'pause-after-local-update',
              run: async (context) =>
                requestHumanGate('session-456', {
                  ...context,
                  draftOutlineVersion: 2
                })
            }
          ]
        },
        payload: { projectId: 'project-1', chapterNumber: null },
        deps: {} as any
      })
    ).resolves.toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        chapterNumber: null,
        draftOutlineVersion: 2,
        waitingForHumanGate: 'session-456'
      })
    );
  });
});
