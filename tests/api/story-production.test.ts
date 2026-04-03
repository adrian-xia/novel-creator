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
  generateChapterFlow: () => ({ name: 'generate-chapter-flow', steps: ['run-chapter-plan-agent'] })
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('story production routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    {
      label: 'outline',
      url: '/projects/project-1/flows/outline',
      flowName: 'generate-outline-flow',
      steps: ['run-outline-agent']
    },
    {
      label: 'volume',
      url: '/projects/project-1/flows/volume',
      flowName: 'generate-volume-flow',
      steps: ['run-volume-agent']
    },
    {
      label: 'next chapter',
      url: '/projects/project-1/flows/next-chapter',
      flowName: 'generate-chapter-flow',
      steps: ['run-chapter-plan-agent']
    }
  ])('creates a queued workflow run for $label generation', async ({ url, flowName, steps }) => {
    createRunMock.mockResolvedValue({
      id: 'workflow-run-1',
      flowName,
      projectId: 'project-1',
      chapterNumber: null,
      status: 'queued'
    });

    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url
    });

    expect(response.statusCode).toBe(202);
    expect(createRunMock).toHaveBeenCalledWith({
      flowName,
      projectId: 'project-1',
      chapterNumber: null
    });
    expect(response.json()).toEqual({
      projectId: 'project-1',
      workflowRunId: 'workflow-run-1',
      flowName,
      status: 'queued',
      steps
    });

    await app.close();
  });
});
