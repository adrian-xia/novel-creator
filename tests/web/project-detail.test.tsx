import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import ProjectDetailPage from '../../apps/web/src/app/projects/[projectId]/page';

describe('ProjectDetailPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the story production sections and open decisions for the project', async () => {
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
          },
          {
            sessionId: 'session-999',
            projectId: 'project-2',
            chapterNumber: 3,
            status: 'awaiting_human_input',
            triggerReason: 'Different project decision.',
            updatedAt: '2026-04-01T00:00:00.000Z'
          }
        ]
      })
    });

    const Page = await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'project-1' })
    } as never);

    const html = renderToString(Page);

    expect(html).toContain('Story Production');
    expect(html).toContain('Outline');
    expect(html).toContain('Volumes');
    expect(html).toContain('Chapters');
    expect(html).toContain('Recent Agent Runs');
    expect(html).toContain('Open Decisions');
    expect(html).toContain('session-123');
    expect(html).not.toContain('Different project decision.');
    expect(html).toContain('/decision-sessions');
  });
});
