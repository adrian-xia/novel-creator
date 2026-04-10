import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import DecisionSessionPage from '../../apps/web/src/app/decision-sessions/[sessionId]/page';
import {
  cancelHumanGate,
  confirmHumanGate,
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

  it('renders human gate recommendations and confirmation controls', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'session-gate-1',
        projectId: 'project-1',
        chapterNumber: null,
        status: 'open',
        triggerReason: 'outline_ready_for_confirmation',
        updatedAt: '2026-04-03T00:00:00.000Z',
        gateType: 'outline_confirmation',
        options: [
          {
            optionId: 'accept-outline',
            title: '直接采用',
            strategy: 'recommended',
            rationale: '结构完整，可直接推进。',
            impactSummary: '立即进入卷规划。',
            patch: { action: 'accept' }
          },
          {
            optionId: 'revise-outline',
            title: '调整后再生成',
            strategy: 'alternative',
            rationale: '如果你想先改设定，可以走这个。',
            impactSummary: '暂停到你确认下一步。',
            patch: { action: 'revise' }
          }
        ],
        recommendedOptionId: 'accept-outline',
        selectedOptionId: null,
        humanNotes: null,
        packet: {
          outline: { title: '卷一' }
        },
        messages: [],
        resolution: null,
        currentDraftResolution: null,
        confirmation: null
      })
    });

    const Page = await DecisionSessionPage({
      params: Promise.resolve({ sessionId: 'session-gate-1' })
    } as never);

    const html = renderToString(Page);

    expect(html).toContain('Recommended Options');
    expect(html).toContain('系统推荐');
    expect(html).toContain('accept-outline');
    expect(html).toContain('采用推荐方案');
    expect(html).toContain('取消 Gate');
    expect(html).toContain('/decision-sessions/session-gate-1/confirm');
    expect(html).toContain('/decision-sessions/session-gate-1/cancel');
    expect(html).toContain('<select');
  });

  it('renders gate action errors from the search params', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'session-gate-1',
        projectId: 'project-1',
        chapterNumber: null,
        status: 'open',
        triggerReason: 'outline_ready_for_confirmation',
        updatedAt: '2026-04-03T00:00:00.000Z',
        gateType: 'outline_confirmation',
        options: [
          {
            optionId: 'accept-outline',
            title: '直接采用',
            strategy: 'recommended',
            rationale: '结构完整，可直接推进。',
            impactSummary: '立即进入卷规划。',
            patch: { action: 'accept' }
          }
        ],
        recommendedOptionId: 'accept-outline',
        selectedOptionId: null,
        humanNotes: null,
        packet: {
          outline: { title: '卷一' }
        },
        messages: [],
        resolution: null,
        currentDraftResolution: null,
        confirmation: null
      })
    });

    const Page = await DecisionSessionPage({
      params: Promise.resolve({ sessionId: 'session-gate-1' }),
      searchParams: Promise.resolve({ error: 'Invalid gate selection' })
    } as never);

    const html = renderToString(Page);

    expect(html).toContain('Action Error:');
    expect(html).toContain('Invalid gate selection');
  });

  it('keeps gate sessions out of the legacy resolution controls even when options are missing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'session-gate-2',
        projectId: 'project-1',
        chapterNumber: null,
        status: 'open',
        triggerReason: 'volume_plans_ready_for_confirmation',
        updatedAt: '2026-04-03T00:00:00.000Z',
        gateType: 'volume_confirmation',
        options: [],
        recommendedOptionId: null,
        selectedOptionId: null,
        humanNotes: null,
        packet: {
          volumePlans: [{ volumeNumber: 1 }]
        },
        messages: [],
        resolution: null,
        currentDraftResolution: null,
        confirmation: null
      })
    });

    const Page = await DecisionSessionPage({
      params: Promise.resolve({ sessionId: 'session-gate-2' })
    } as never);

    const html = renderToString(Page);

    expect(html).toContain('Gate Type:');
    expect(html).toContain('volume_confirmation');
    expect(html).toContain('No gate options available.');
    expect(html).toContain('Gate options are unavailable, so confirmation is disabled.');
    expect(html).toContain('取消 Gate');
    expect(html).not.toContain('Send Message');
  });

  it('hides gate actions after the session is resolved', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'session-gate-3',
        projectId: 'project-1',
        chapterNumber: null,
        status: 'resolved',
        triggerReason: 'outline_ready_for_confirmation',
        updatedAt: '2026-04-03T00:00:00.000Z',
        gateType: 'outline_confirmation',
        options: [
          {
            optionId: 'accept-outline',
            title: '直接采用',
            strategy: 'recommended',
            rationale: '结构完整，可直接推进。',
            impactSummary: '立即进入卷规划。',
            patch: { action: 'accept' }
          }
        ],
        recommendedOptionId: 'accept-outline',
        selectedOptionId: 'accept-outline',
        humanNotes: '继续推进',
        packet: {
          outline: { title: '卷一' }
        },
        messages: [],
        resolution: null,
        currentDraftResolution: null,
        confirmation: null
      })
    });

    const Page = await DecisionSessionPage({
      params: Promise.resolve({ sessionId: 'session-gate-3' })
    } as never);

    const html = renderToString(Page);

    expect(html).toContain('已确认选项');
    expect(html).toContain('Gate actions are no longer available for this session status.');
    expect(html).not.toContain('采用推荐方案');
    expect(html).not.toContain('取消 Gate');
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'session-gate-1',
          status: 'resolved',
          selectedOptionId: 'accept-outline',
          humanNotes: '保留主线'
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'session-gate-1',
          status: 'cancelled'
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
    await confirmHumanGate('session-gate-1', {
      selectedOptionId: 'accept-outline',
      humanNotes: '保留主线'
    });
    await cancelHumanGate('session-gate-1');

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
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://localhost:3001/decision-sessions/session-gate-1/confirm',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          selectedOptionId: 'accept-outline',
          humanNotes: '保留主线'
        })
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'http://localhost:3001/decision-sessions/session-gate-1/cancel',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );
  });
});
