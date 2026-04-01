import { describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';
import { decisionSessionFlow, publishChapterFlow } from '../../packages/workflows/src';

describe('phase 3 smoke', () => {
  it('exposes the decision, publishing, and workflow observability surfaces', async () => {
    const app = buildApp();

    const decisionQueue = await app.inject({ method: 'GET', url: '/decision-sessions' });
    const publishTasks = await app.inject({ method: 'GET', url: '/publish-tasks' });
    const workflowRuns = await app.inject({ method: 'GET', url: '/workflow-runs' });

    expect(decisionSessionFlow().name).toBe('decision-session-flow');
    expect(publishChapterFlow().name).toBe('publish-chapter-flow');
    expect(decisionQueue.statusCode).toBe(200);
    expect(publishTasks.statusCode).toBe(200);
    expect(workflowRuns.statusCode).toBe(200);

    await app.close();
  });
});
