import { describe, expect, it } from 'vitest';
import { decisionSessionFlow } from '../../packages/workflows/src/decision-session-flow';

describe('decisionSessionFlow', () => {
  it('defines the session creation and resolution lifecycle', () => {
    const flow = decisionSessionFlow();
    expect(flow.name).toBe('decision-session-flow');
    expect(flow.steps).toEqual([
      'load-blocked-review',
      'build-decision-packet',
      'create-decision-session',
      'await-human-and-assistant-conversation',
      'persist-decision-resolution',
      'apply-resolution'
    ]);
  });
});
