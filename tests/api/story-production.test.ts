import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

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

describe('story production routes', () => {
  it('queues the outline flow for a project', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/flows/outline'
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      flowName: 'generate-outline-flow',
      status: 'queued',
      steps: ['run-outline-agent']
    });
  });
});
