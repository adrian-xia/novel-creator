import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectFlow, enqueueWorkflow } from '../../packages/workflows/src';

const { runInstrumentedWorkflow } = vi.hoisted(() => ({
  runInstrumentedWorkflow: vi.fn()
}));

vi.mock('../../packages/workflows/src/workflow-runner', () => ({
  runInstrumentedWorkflow
}));

import { startWorker } from '../../apps/worker/src/worker';

describe('createProjectFlow', () => {
  beforeEach(() => {
    runInstrumentedWorkflow.mockReset();
  });

  it('returns the initial workflow step list', () => {
    const flow = createProjectFlow();

    expect(flow.steps).toEqual([
      'persist-project',
      'enqueue-outline',
      'mark-project-active'
    ]);
  });

  it('enqueues the create-project workflow', () => {
    const result = enqueueWorkflow(createProjectFlow());

    expect(result).toEqual({
      flowName: 'create-project-flow',
      status: 'queued',
      steps: ['persist-project', 'enqueue-outline', 'mark-project-active']
    });
  });

  it('starts the worker with the create-project workflow by default', async () => {
    runInstrumentedWorkflow.mockResolvedValue({
      flowName: 'create-project-flow',
      stepCount: 3
    });

    await expect(startWorker()).resolves.toEqual({
      flowName: 'create-project-flow',
      stepCount: 3
    });

    expect(runInstrumentedWorkflow).toHaveBeenCalledWith({
      flow: {
        name: 'create-project-flow',
        steps: ['persist-project', 'enqueue-outline', 'mark-project-active']
      },
      payload: {
        projectId: 'system',
        chapterNumber: null
      },
      deps: {}
    });
  });
});
