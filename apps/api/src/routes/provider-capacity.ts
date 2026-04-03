import type { FastifyInstance } from 'fastify';
import type { ProviderCapacity } from '../../../../packages/domain/src';
import { parseProviderCapacityPayload } from './validation';

async function getProviderCapacityRepository() {
  const { ProviderCapacityRepository } = await import(
    '../../../../packages/storage/src/repositories/provider-capacity-repository'
  );

  return new ProviderCapacityRepository();
}

export function registerProviderCapacityRoutes(app: FastifyInstance) {
  app.post('/provider-capacity', async (request, reply) => {
    const providerCapacityPayload = parseProviderCapacityPayload(request.body);

    if (!providerCapacityPayload) {
      return reply.code(400).send({ message: 'Invalid provider capacity payload' });
    }

    const providerCapacity: ProviderCapacity = {
      ...providerCapacityPayload,
      id: crypto.randomUUID()
    };
    const repository = await getProviderCapacityRepository();
    const savedProviderCapacity = await repository.create(providerCapacity);

    return reply.code(201).send(savedProviderCapacity);
  });
}
