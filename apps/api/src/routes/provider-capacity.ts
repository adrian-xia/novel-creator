import type { FastifyInstance } from 'fastify';
import type { ProviderCapacity } from '../../../../packages/domain/src/provider-capacity';

export function registerProviderCapacityRoutes(app: FastifyInstance) {
  app.post('/provider-capacity', async (request, reply) => {
    const providerCapacity = {
      ...(request.body as Omit<ProviderCapacity, 'id'>),
      id: crypto.randomUUID()
    } satisfies ProviderCapacity;

    return reply.code(201).send(providerCapacity);
  });
}
