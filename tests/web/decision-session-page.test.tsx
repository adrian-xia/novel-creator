import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import DecisionSessionPage from '../../apps/web/src/app/decision-sessions/[sessionId]/page';

describe('DecisionSessionPage', () => {
  it('renders packet, messages, and resolution panel placeholders', async () => {
    const Page = await DecisionSessionPage({
      params: Promise.resolve({ sessionId: 'session-1' })
    } as never);

    const html = renderToString(Page);

    expect(html).toContain('Decision Session');
    expect(html).toContain('delay the reveal');
  });
});
