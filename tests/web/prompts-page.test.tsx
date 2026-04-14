import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PromptsPage from '../../apps/web/src/app/prompts/page';

describe('PromptsPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the prompt catalog and bootstrap action', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'prompt-1',
            agentName: 'outline-agent',
            version: 1,
            systemPrompt: 'You are the outline planner.',
            taskTemplate: 'Generate the outline.',
            outputSchema: { type: 'object' },
            reviewRubric: null,
            enabled: true,
            lastTestedModel: 'deepseek-r1'
          },
          {
            id: 'prompt-2',
            agentName: 'review-agent',
            version: 1,
            systemPrompt: 'You are the review agent.',
            taskTemplate: 'Review the chapter.',
            outputSchema: { type: 'object' },
            reviewRubric: 'Check pacing.',
            enabled: true,
            lastTestedModel: 'deepseek-r1'
          }
        ]
      })
    });

    const Page = await PromptsPage();
    const html = renderToString(Page);

    expect(html).toContain('Agent Prompts');
    expect(html).toContain('Bootstrap Default Prompts');
    expect(html).toContain('/prompts/bootstrap');
    expect(html).toContain('outline-agent');
    expect(html).toContain('review-agent');
    expect(html).toContain('deepseek-r1');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/prompts', undefined);
  });
});
