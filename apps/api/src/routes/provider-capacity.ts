import type { FastifyInstance } from 'fastify';
import type { ProviderCapacity } from '../../../../packages/domain/src';
import { parseProviderCapacityPayload } from './validation';

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

    return reply.code(201).send(providerCapacity);
  });
}
