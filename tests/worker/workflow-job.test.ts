import { describe, expect, it } from 'vitest';
import { runWorkflowJob } from '../../apps/worker/src/jobs/workflow-job';

describe('runWorkflowJob', () => {
  it('dispatches the decision-session workflow', async () => {
    await expect(runWorkflowJob('decision-session-flow')).resolves.toEqual({
      flowName: 'decision-session-flow',
      status: 'queued',
      steps: [
        'load-blocked-review',
        'build-decision-packet',
        'create-decision-session',
        'await-human-and-assistant-conversation',
        'persist-decision-resolution',
        'apply-resolution'
      ]
    });
  });
});
