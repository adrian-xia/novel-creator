import type { FastifyInstance } from 'fastify';
import { buildDecisionResolutionDraft } from '../../../../packages/agent-runtime/src/decision-resolution-draft';
import {
  parseDecisionMessagePayload,
  parseDecisionResolutionDraftPayload,
  parseDecisionResolutionPayload
} from './validation';

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
    const payload = parseDecisionMessagePayload(request.body);

    if (!payload) {
      return reply.code(400).send({
        message: 'Invalid decision message payload'
      });
    }

    return reply.code(201).send({
      sessionId,
      status: 'queued_assistant_reply'
    });
  });

  app.post('/decision-sessions/:sessionId/generate-resolution', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const payload = parseDecisionResolutionDraftPayload(request.body);

    if (!payload) {
      return reply.code(400).send({
        message: 'Invalid decision resolution payload'
      });
    }

    const resolution = buildDecisionResolutionDraft({
      sessionId,
      resolutionType: payload.resolutionType,
      decisionSummary: payload.decisionSummary,
      storyFactsToApply: payload.storyFactsToApply,
      chapterPlanAdjustments: payload.chapterPlanAdjustments,
      volumeImpact: payload.volumeImpact,
      replanRange: payload.replanRange
    });

    return reply.code(200).send({
      sessionId,
      status: 'awaiting_resolution_confirmation',
      resolution,
      confirmation: {
        required: true,
        requestType: 'confirm_resolution'
      }
    });
  });

  app.post('/decision-sessions/:sessionId/resolve', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const payload = parseDecisionResolutionPayload(request.body);

    if (!payload) {
      return reply.code(400).send({
        message: 'Invalid decision resolution payload'
      });
    }

    return reply.code(200).send({
      sessionId,
      status: 'resolved',
      resolution: {
        sessionId,
        ...payload
      }
    });
  });
}
