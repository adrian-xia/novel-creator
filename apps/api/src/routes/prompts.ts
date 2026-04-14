import type { FastifyInstance } from 'fastify';
import type { PromptConfig } from '../../../../packages/domain/src';
import { buildDefaultPromptConfigs } from '../../../../packages/workflows/src/default-prompt-catalog';
import { parsePromptPayload } from './validation';

async function getPromptRepository() {
  const { PromptRepository } = await import(
    '../../../../packages/storage/src/repositories/prompt-repository'
  );

  return new PromptRepository();
}

export function registerPromptRoutes(app: FastifyInstance) {
  app.get('/prompts', async () => {
    const repository = await getPromptRepository();
    const items = await repository.listAll();

    return {
      items
    };
  });

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

  app.post('/prompts/bootstrap', async (_request, reply) => {
    const repository = await getPromptRepository();
    const items = [];

    for (const prompt of buildDefaultPromptConfigs()) {
      items.push(await repository.upsert(prompt));
    }

    return reply.code(201).send({
      count: items.length,
      items
    });
  });
}
