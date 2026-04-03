import type { FastifyInstance } from 'fastify';
import type { PromptConfig } from '../../../../packages/domain/src';
import { parsePromptPayload } from './validation';

async function getPromptRepository() {
  const { PromptRepository } = await import(
    '../../../../packages/storage/src/repositories/prompt-repository'
  );

  return new PromptRepository();
}

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
    const repository = await getPromptRepository();
    const savedPrompt = await repository.create(prompt);

    return reply.code(201).send(savedPrompt);
  });
}
