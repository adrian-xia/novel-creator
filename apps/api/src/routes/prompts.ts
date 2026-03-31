import type { FastifyInstance } from 'fastify';
import type { PromptConfig } from '../../../../packages/domain/src';
import { parsePromptPayload } from './validation';

export function registerPromptRoutes(app: FastifyInstance) {
  app.post('/prompts', async (request, reply) => {
    const promptPayload = parsePromptPayload(request.body);

    if (!promptPayload) {
      return reply.code(400).send({ message: 'Invalid prompt payload' });
    }

    const prompt: PromptConfig = {
      ...promptPayload,
      id: crypto.randomUUID()
    };

    return reply.code(201).send(prompt);
  });
}
