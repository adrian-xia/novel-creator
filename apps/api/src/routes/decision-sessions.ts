import type { FastifyInstance } from 'fastify';

export function registerDecisionSessionRoutes(app: FastifyInstance) {
  app.get('/decision-sessions', async () => ({ items: [] }));

  app.get('/decision-sessions/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };

    return {
      sessionId,
      packet: null,
      messages: [],
      resolution: null
    };
  });

  app.post('/decision-sessions/:sessionId/messages', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    return reply.code(201).send({
      sessionId,
      status: 'queued_assistant_reply'
    });
  });

  app.post('/decision-sessions/:sessionId/resolve', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    return reply.code(200).send({
      sessionId,
      status: 'resolved'
    });
  });
}
