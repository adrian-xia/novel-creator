import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import DecisionQueuePage from '../../apps/web/src/app/decision-sessions/page';

describe('DecisionQueuePage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the live decision queue items', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            sessionId: 'session-123',
            projectId: 'project-1',
            chapterNumber: 8,
            status: 'awaiting_human_input',
            triggerReason: 'Continuity conflict detected in chapter review.',
            updatedAt: '2026-04-02T00:00:00.000Z'
          }
        ]
      })
    });

    const Page = await DecisionQueuePage();
    const html = renderToString(Page);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/decision-sessions', undefined);
    expect(html).toContain('Decision Queue');
    expect(html).toContain('session-123');
    expect(html).toContain('Continuity conflict detected in chapter review.');
    expect(html).toContain('awaiting_human_input');
  });
});
