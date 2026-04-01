import { describe, expect, it } from 'vitest';
import { buildResolutionDraft } from '../../packages/agent-runtime/src/decision-assistant';

describe('buildResolutionDraft', () => {
  it('turns a candidate direction into a structured resolution draft', () => {
    const draft = buildResolutionDraft({
      sessionId: 'session-1',
      direction: 'delay reveal',
      rationale: 'preserve pacing'
    });

    expect(draft.resolutionType).toBe('accept_alternative');
    expect(draft.nextAction).toBe('replan_chapter');
  });
});
