import type { FastifyInstance } from 'fastify';
import { buildDecisionResolutionDraft } from '../../../../packages/agent-runtime/src/decision-resolution-draft';
import {
  parseDecisionMessagePayload,
  parseDecisionResolutionDraftPayload,
  parseDecisionResolutionPayload
} from './validation';

const baseTimestamp = '2026-04-02T00:00:00.000Z';

function buildSessionSummary(sessionId: string) {
  return {
    sessionId,
    projectId: 'project-1',
    chapterNumber: 8,
    status: 'awaiting_human_input' as const,
    triggerReason: 'Continuity conflict detected in chapter review.',
    updatedAt: baseTimestamp
  };
}

function buildSessionDetail(sessionId: string) {
  return {
    ...buildSessionSummary(sessionId),
    packet: {
      reviewOutcomeId: 'review-456',
      summary: 'Two scenes disagree on who knows the villain identity.'
    },
    messages: [
      {
        sessionId,
        sequence: 1,
        role: 'system' as const,
        messageType: 'system' as const,
        content: 'Decision session opened for chapter 8 continuity review.',
        createdAt: baseTimestamp
      }
    ],
    resolution: null,
    confirmation: null
  };
}

export function registerDecisionSessionRoutes(app: FastifyInstance) {
  app.get('/decision-sessions', async () => ({
    items: [buildSessionSummary('session-123')]
  }));

  app.get('/decision-sessions/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };

    return buildSessionDetail(sessionId);
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
      status: 'awaiting_assistant_reply',
      appendedMessage: {
        sessionId,
        sequence: 2,
        role: payload.role,
        messageType: payload.messageType,
        content: payload.content,
        createdAt: baseTimestamp
      },
      assistantWork: {
        status: 'queued',
        taskType: 'generate_decision_reply'
      }
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
