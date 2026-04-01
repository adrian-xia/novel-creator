import type { FastifyInstance } from 'fastify';
import {
  enqueueWorkflow,
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow
} from '../../../../packages/workflows/src';

export function registerStoryProductionRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/flows/outline', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    return reply.code(202).send({
      projectId,
      ...enqueueWorkflow(generateOutlineFlow())
    });
  });

  app.post('/projects/:projectId/flows/volume', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    return reply.code(202).send({
      projectId,
      ...enqueueWorkflow(generateVolumeFlow())
    });
  });

  app.post('/projects/:projectId/flows/next-chapter', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    return reply.code(202).send({
      projectId,
      ...enqueueWorkflow(generateChapterFlow())
    });
  });
}
