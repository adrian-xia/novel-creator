import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import WorkflowRunsPage from '../../apps/web/src/app/runs/page';
import WorkflowRunDetailPage from '../../apps/web/src/app/runs/[runId]/page';

describe('WorkflowRunsPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders workflow runs from the live API payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            runId: 'run-1',
            flowName: 'publish-chapter-flow',
            status: 'running'
          }
        ]
      })
    });

    const Page = await WorkflowRunsPage();
    const html = renderToString(Page);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/workflow-runs', undefined);
    expect(html).toContain('Workflow Runs');
    expect(html).toContain('publish-chapter-flow');
    expect(html).toContain('run-1');
  });

  it('renders workflow run detail from the live API payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        runId: 'run-1',
        flowName: 'publish-chapter-flow',
        steps: [
          {
            stepName: 'expand-publish-tasks',
            status: 'succeeded'
          }
        ]
      })
    });

    const Page = await WorkflowRunDetailPage({
      params: Promise.resolve({ runId: 'run-1' })
    } as never);
    const html = renderToString(Page);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/workflow-runs/run-1', undefined);
    expect(html).toContain('Run Detail');
    expect(html).toContain('publish-chapter-flow');
    expect(html).toContain('expand-publish-tasks');
  });
});
