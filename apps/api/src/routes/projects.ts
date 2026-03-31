import type { FastifyInstance } from 'fastify';
import { createNovelProject } from '../../../../packages/domain/src/novel-project';

export function registerProjectRoutes(app: FastifyInstance) {
  app.post('/projects', async (request, reply) => {
    const project = createNovelProject(request.body as any);
    return reply.code(201).send(project);
  });
}
