import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

const createRunMock = vi.hoisted(() => vi.fn());
const continueProjectMock = vi.hoisted(() => vi.fn());

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
  continueProject: continueProjectMock,
  generateOutlineFlow: () => ({
    name: 'generate-outline-flow',
    steps: [
      'load-project-input',
      'load-outline-prompt',
      'run-outline-agent',
      'validate-outline-output',
      'persist-outline'
    ]
  }),
  generateVolumeFlow: () => ({
    name: 'generate-volume-flow',
    steps: [
      'load-outline',
      'load-volume-prompt',
      'run-volume-agent',
      'validate-volume-output',
      'persist-volume-plans'
    ]
  }),
  generateChapterFlow: () => ({
    name: 'generate-chapter-flow',
    steps: ['execute-chapter-generation', 'execute-review-rewrite']
  })
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
      steps: [
        'load-project-input',
        'load-outline-prompt',
        'run-outline-agent',
        'validate-outline-output',
        'persist-outline'
      ]
    },
    {
      label: 'volume',
      url: '/projects/project-1/flows/volume',
      flowName: 'generate-volume-flow',
      steps: [
        'load-outline',
        'load-volume-prompt',
        'run-volume-agent',
        'validate-volume-output',
        'persist-volume-plans'
      ]
    },
    {
      label: 'next chapter',
      url: '/projects/project-1/flows/next-chapter',
      flowName: 'generate-chapter-flow',
      steps: ['execute-chapter-generation', 'execute-review-rewrite']
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

  it('routes unified project continuation through the shared continue strategy', async () => {
    continueProjectMock.mockResolvedValue({
      projectId: 'project-1',
      continued: true,
      action: 'generate_next_chapter',
      reason: 'Project is ready to generate the next chapter.',
      workflowRunId: 'workflow-run-9',
      flowName: 'generate-chapter-flow',
      status: 'queued',
      steps: ['execute-chapter-generation', 'execute-review-rewrite'],
      autoContinuedChapters: 0
    });

    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/continue'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projectId: 'project-1',
      continued: true,
      action: 'generate_next_chapter',
      reason: 'Project is ready to generate the next chapter.',
      workflowRunId: 'workflow-run-9',
      flowName: 'generate-chapter-flow',
      status: 'queued',
      steps: ['execute-chapter-generation', 'execute-review-rewrite'],
      autoContinuedChapters: 0
    });
    expect(continueProjectMock).toHaveBeenCalledWith('project-1');

    await app.close();
  });
});
