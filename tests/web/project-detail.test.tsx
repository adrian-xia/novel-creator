import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import ProjectDetailPage from '../../apps/web/src/app/projects/[projectId]/page';

describe('ProjectDetailPage', () => {
  it('renders the story production sections', async () => {
    const Page = await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'project-1' })
    } as never);

    const html = renderToString(Page);

    expect(html).toContain('Story Production');
    expect(html).toContain('Outline');
    expect(html).toContain('Volumes');
    expect(html).toContain('Chapters');
    expect(html).toContain('Recent Agent Runs');
  });
});
