import type { FastifyInstance } from 'fastify';
import { parsePublishProfilePayload } from './validation';

export function registerPublishingRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/publish-profile', async (request) => {
    const { projectId } = request.params as { projectId: string };

    return {
      projectId,
      publishEnabled: false,
      autoPublishTargets: [],
      manualExportTargets: [],
      defaultExportFormat: 'markdown',
      effectiveFromChapter: null
    };
  });

  app.put('/projects/:projectId/publish-profile', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = parsePublishProfilePayload(request.body);

    if (!payload) {
      return reply.code(400).send({ error: 'Invalid publish profile payload' });
    }

    return {
      projectId,
      ...payload
    };
  });

  app.get('/publish-tasks', async () => ({ items: [], artifacts: [] }));

  app.post('/publish-tasks/:taskId/manual-upload-confirm', async (request) => {
    const { taskId } = request.params as { taskId: string };

    return {
      taskId,
      status: 'manual_upload_confirmed'
    };
  });
}
