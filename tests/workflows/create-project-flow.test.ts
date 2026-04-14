import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectFlow } from '../../packages/workflows/src/create-project-flow';
import { enqueueWorkflow } from '../../packages/workflows/src/enqueue';

const { runWorkflowJob } = vi.hoisted(() => ({
  runWorkflowJob: vi.fn()
}));

vi.mock('../../apps/worker/src/jobs/workflow-job', () => ({
  runWorkflowJob
}));

import { startWorker } from '../../apps/worker/src/worker';

describe('createProjectFlow', () => {
  beforeEach(() => {
    runWorkflowJob.mockReset();
  });

  it('returns the initial workflow step list', () => {
    const flow = createProjectFlow();

    expect(flow.name).toBe('create-project-flow');
    expect(flow.steps.map((step) => step.name)).toEqual([
      'persist-project',
      'enqueue-outline',
      'mark-project-active'
    ]);
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
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
    runWorkflowJob.mockResolvedValue({
      flowName: 'create-project-flow',
      stepCount: 3
    });

    await expect(startWorker()).resolves.toEqual({
      flowName: 'create-project-flow',
      stepCount: 3
    });
    expect(runWorkflowJob).toHaveBeenCalledWith('create-project-flow');
  });
});
