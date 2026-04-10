import { describe, expect, it } from 'vitest';
import { decisionSessionFlow } from '../../packages/workflows/src/decision-session-flow';

describe('decisionSessionFlow', () => {
  it('defines the decision recovery lifecycle', () => {
    const flow = decisionSessionFlow();
    expect(flow.name).toBe('decision-session-flow');
    expect(flow.steps.map((step) => step.name)).toEqual([
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
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
  });
});
