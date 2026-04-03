import { describe, expect, it, vi } from 'vitest';
import { POST as postMessage } from '../../apps/web/src/app/decision-sessions/[sessionId]/messages/route';
import { POST as postDraft } from '../../apps/web/src/app/decision-sessions/[sessionId]/generate-resolution/route';
import { POST as postResolve } from '../../apps/web/src/app/decision-sessions/[sessionId]/resolve/route';

describe('decision session web routes', () => {
  it('proxies message form submissions to the API JSON endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true
      })
    );

    const formData = new FormData();
    formData.set('content', 'Keep the reveal later.');

    const response = await postMessage(
      new Request('http://localhost/decision-sessions/session-1/messages', {
        method: 'POST',
        body: formData
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) }
    );

    expect(response.status).toBe(303);
  });

  it('proxies draft generation form submissions to the API JSON endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.set('resolutionType', 'replan_required');
    formData.set('decisionSummary', 'Delay the reveal.');
    formData.append('storyFactsToApply', 'The reveal remains delayed.');
    formData.append('chapterPlanAdjustments', 'Move the reveal scene.');
    formData.set('volumeImpact', '');
    formData.set('replanRangeStartChapter', '8');
    formData.set('replanRangeEndChapter', '10');

    const response = await postDraft(
      new Request('http://localhost/decision-sessions/session-1/generate-resolution', {
        method: 'POST',
        body: formData
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) }
    );

    expect(response.status).toBe(303);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/decision-sessions/session-1/generate-resolution',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          resolutionType: 'replan_required',
          decisionSummary: 'Delay the reveal.',
          storyFactsToApply: ['The reveal remains delayed.'],
          chapterPlanAdjustments: ['Move the reveal scene.'],
          volumeImpact: null,
          replanRange: { startChapter: 8, endChapter: 10 }
        })
      }
    );
  });

  it('proxies resolution confirmations to the API JSON endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.set('resolutionType', 'accept_alternative');
    formData.set('decisionSummary', 'Delay the reveal.');
    formData.append('storyFactsToApply', 'The reveal remains delayed.');
    formData.append('chapterPlanAdjustments', 'Move the reveal scene.');
    formData.set('volumeImpact', '');
    formData.set('nextAction', 'resume_current_chapter');
    formData.set('resumeFromChapter', '');
    formData.set('replanRangeStartChapter', '');
    formData.set('replanRangeEndChapter', '');
    formData.set('invalidateExistingPlans', 'false');

    const response = await postResolve(
      new Request('http://localhost/decision-sessions/session-1/resolve', {
        method: 'POST',
        body: formData
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) }
    );

    expect(response.status).toBe(303);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/decision-sessions/session-1/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        resolutionType: 'accept_alternative',
        decisionSummary: 'Delay the reveal.',
        storyFactsToApply: ['The reveal remains delayed.'],
        chapterPlanAdjustments: ['Move the reveal scene.'],
        volumeImpact: null,
        nextAction: 'resume_current_chapter',
        replanRange: null,
        resumeFromChapter: null,
        invalidateExistingPlans: false
      })
    });
  });
});
