import type { FastifyInstance } from 'fastify';

export function registerWorkflowRunRoutes(app: FastifyInstance) {
  app.get('/workflow-runs', async () => ({ items: [] }));

  app.get('/workflow-runs/:runId', async (request) => {
    const { runId } = request.params as { runId: string };

    return {
      runId,
      flowName: 'unknown',
      steps: []
    };
  });
}
