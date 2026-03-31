import type { FastifyInstance } from 'fastify';
import type { PromptConfig } from '../../../../packages/domain/src/prompt-config';

export function registerPromptRoutes(app: FastifyInstance) {
  app.post('/prompts', async (request, reply) => {
    const prompt = {
      ...(request.body as Omit<PromptConfig, 'id'>),
      id: crypto.randomUUID()
    } satisfies PromptConfig;

    return reply.code(201).send(prompt);
  });
}
