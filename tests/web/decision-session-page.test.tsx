import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import DecisionSessionPage from '../../apps/web/src/app/decision-sessions/[sessionId]/page';
import {
  confirmDecisionResolution,
  createDecisionMessage,
  generateDecisionResolutionDraft
} from '../../apps/web/src/lib/api';

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
    expect(html).toContain('Send Message');
    expect(html).toContain('Generate Draft Resolution');
    expect(html).toContain('Confirm Resolution');
    expect(html).toContain('/decision-sessions/session-1/messages');
    expect(html).toContain('/decision-sessions/session-1/generate-resolution');
    expect(html).toContain('/decision-sessions/session-1/resolve');
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

  it('posts decision-session actions to the live API routes', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'session-1',
          status: 'awaiting_assistant_reply',
          appendedMessage: { sequence: 4 },
          assistantWork: { flowName: 'decision-session-flow' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'session-1',
          status: 'awaiting_resolution_confirmation',
          resolution: { resolutionType: 'accept_alternative' },
          confirmation: {
            required: true,
            requestType: 'confirm_resolution'
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'session-1',
          status: 'resolved',
          resolution: { resolutionType: 'accept_alternative' },
          recoveryWork: null
        })
      });

    await createDecisionMessage('session-1', { content: 'Keep the reveal later.' });
    await generateDecisionResolutionDraft('session-1', {
      resolutionType: 'accept_alternative',
      decisionSummary: 'Delay the reveal to chapter 12.',
      storyFactsToApply: ['The reveal stays hidden.'],
      chapterPlanAdjustments: ['Push the reveal scene later.'],
      volumeImpact: null,
      replanRange: null
    });
    await confirmDecisionResolution('session-1', {
      resolutionType: 'accept_alternative',
      decisionSummary: 'Delay the reveal to chapter 12.',
      storyFactsToApply: ['The reveal stays hidden.'],
      chapterPlanAdjustments: ['Push the reveal scene later.'],
      volumeImpact: null,
      nextAction: 'resume_current_chapter',
      replanRange: null,
      resumeFromChapter: null,
      invalidateExistingPlans: false
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/decision-sessions/session-1/messages',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Keep the reveal later.'
        })
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/decision-sessions/session-1/generate-resolution',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          resolutionType: 'accept_alternative',
          decisionSummary: 'Delay the reveal to chapter 12.',
          storyFactsToApply: ['The reveal stays hidden.'],
          chapterPlanAdjustments: ['Push the reveal scene later.'],
          volumeImpact: null,
          replanRange: null
        })
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3001/decision-sessions/session-1/resolve',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          resolutionType: 'accept_alternative',
          decisionSummary: 'Delay the reveal to chapter 12.',
          storyFactsToApply: ['The reveal stays hidden.'],
          chapterPlanAdjustments: ['Push the reveal scene later.'],
          volumeImpact: null,
          nextAction: 'resume_current_chapter',
          replanRange: null,
          resumeFromChapter: null,
          invalidateExistingPlans: false
        })
      }
    );
  });
});
