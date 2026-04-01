import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import WorkflowRunsPage from '../../apps/web/src/app/runs/page';

describe('WorkflowRunsPage', () => {
  it('renders workflow runs', async () => {
    const Page = await WorkflowRunsPage();
    const html = renderToString(Page);

    expect(html).toContain('Workflow Runs');
    expect(html).toContain('publish-chapter-flow');
  });
});
