import { describe, expect, it } from 'vitest';
import { createProjectFlow, enqueueWorkflow } from '../../packages/workflows/src';
import { startWorker } from '../../apps/worker/src/worker';

describe('createProjectFlow', () => {
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
    await expect(startWorker()).resolves.toEqual({
      flowName: 'create-project-flow',
      status: 'queued',
      steps: ['persist-project', 'enqueue-outline', 'mark-project-active']
    });
  });
});
