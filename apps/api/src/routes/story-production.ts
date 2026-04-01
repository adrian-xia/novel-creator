import type { FastifyInstance } from 'fastify';
import {
  enqueueWorkflow,
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow
} from '../../../../packages/workflows/src';

export function registerStoryProductionRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/flows/outline', async (_request, reply) => {
    return reply.code(202).send(enqueueWorkflow(generateOutlineFlow()));
  });

  app.post('/projects/:projectId/flows/volume', async (_request, reply) => {
    return reply.code(202).send(enqueueWorkflow(generateVolumeFlow()));
  });

  app.post('/projects/:projectId/flows/next-chapter', async (_request, reply) => {
    return reply.code(202).send(enqueueWorkflow(generateChapterFlow()));
  });
}
