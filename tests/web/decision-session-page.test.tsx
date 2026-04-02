import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import DecisionSessionPage from '../../apps/web/src/app/decision-sessions/[sessionId]/page';

describe('DecisionSessionPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders decision history, draft resolution, and confirmation controls from the live detail payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'session-1',
        projectId: 'project-1',
        chapterNumber: 8,
        status: 'awaiting_resolution_confirmation',
        triggerReason: 'Continuity conflict detected in chapter review.',
        updatedAt: '2026-04-02T00:00:00.000Z',
        packet: {
          reviewOutcomeId: 'review-456',
          summary: 'Two scenes disagree on who knows the villain identity.'
        },
        messages: [
          {
            sessionId: 'session-1',
            sequence: 1,
            role: 'system',
            messageType: 'system',
            content: 'Decision session opened for chapter 8 continuity review.',
            createdAt: '2026-04-02T00:00:00.000Z'
          },
          {
            sessionId: 'session-1',
            sequence: 2,
            role: 'human',
            messageType: 'human',
            content: 'Keep the reveal later and preserve the mentor scene.',
            createdAt: '2026-04-02T00:02:00.000Z'
          },
          {
            sessionId: 'session-1',
            sequence: 3,
            role: 'assistant',
            messageType: 'assistant',
            content: 'Drafted an alternative that delays the reveal to chapter 12.',
            createdAt: '2026-04-02T00:03:00.000Z'
          }
        ],
        resolution: null,
        currentDraftResolution: {
          resolutionType: 'accept_alternative',
          decisionSummary: 'Delay the villain reveal to chapter 12.'
        },
        confirmation: {
          required: true,
          requestType: 'confirm_resolution'
        }
      })
    });

    const Page = await DecisionSessionPage({
      params: Promise.resolve({ sessionId: 'session-1' })
    } as never);

    const html = renderToString(Page);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/decision-sessions/session-1', undefined);
    expect(html).toContain('Decision Session');
    expect(html).toContain('Two scenes disagree on who knows the villain identity.');
    expect(html).toContain('Keep the reveal later and preserve the mentor scene.');
    expect(html).toContain('Drafted an alternative that delays the reveal to chapter 12.');
    expect(html).toContain('Delay the villain reveal to chapter 12.');
    expect(html).toContain('confirm_resolution');
  });

  it('renders a not-found state when the API returns a missing-session payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: 'Decision session not found'
      })
    });

    const Page = await DecisionSessionPage({
      params: Promise.resolve({ sessionId: 'missing-session' })
    } as never);

    const html = renderToString(Page);

    expect(html).toContain('Decision Session');
    expect(html).toContain('Decision session not found');
  });
});
