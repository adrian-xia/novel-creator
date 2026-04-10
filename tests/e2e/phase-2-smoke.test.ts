import { beforeEach, describe, expect, it, vi } from 'vitest';

const createRunMock = vi.hoisted(() => vi.fn());

vi.mock('../../packages/storage/src/repositories/workflow-run-repository', () => ({
  WorkflowRunRepository: class {
    createRun = createRunMock;
  }
}));

vi.mock('../../packages/workflows/src', () => ({
  enqueueWorkflow: vi.fn((flow: { name: string; steps: string[] }) => ({
    flowName: flow.name,
    status: 'queued',
    steps: flow.steps
  })),
  generateOutlineFlow: () => ({ name: 'generate-outline-flow', steps: ['run-outline-agent'] }),
  generateVolumeFlow: () => ({ name: 'generate-volume-flow', steps: ['run-volume-agent'] }),
  generateChapterFlow: () => ({
    name: 'generate-chapter-flow',
    steps: ['execute-chapter-generation']
  }),
  reviewRewriteFlow: () => ({
    name: 'review-rewrite-flow',
    steps: ['execute-review-rewrite']
  })
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('phase 2 smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('creates and returns a workflow run for story production', async () => {
    createRunMock.mockResolvedValue({
      id: 'workflow-run-1',
      flowName: 'generate-outline-flow',
      projectId: 'project-1',
      chapterNumber: null,
      status: 'queued'
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/flows/outline'
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      projectId: 'project-1',
      workflowRunId: 'workflow-run-1',
      flowName: 'generate-outline-flow',
      status: 'queued'
    });
    expect(createRunMock).toHaveBeenCalledWith({
      flowName: 'generate-outline-flow',
      projectId: 'project-1',
      chapterNumber: null
    });

    await app.close();
  });
});
