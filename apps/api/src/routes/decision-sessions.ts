import type { FastifyInstance } from 'fastify';
import { buildDecisionResolutionDraft } from '../../../../packages/agent-runtime/src/decision-resolution-draft';
import { DecisionSessionRepository } from '../../../../packages/storage/src/repositories/decision-session-repository';
import { ProjectRepository } from '../../../../packages/storage/src/repositories/project-repository';
import {
  parseDecisionMessagePayload,
  parseDecisionResolutionDraftPayload,
  parseDecisionResolutionPayload
} from './validation';

function toSessionSummary(record: {
  id: string;
  projectId: string;
  chapterNumber: number;
  status: string;
  triggerReason: string | null;
  updatedAt: Date | string;
}) {
  return {
    sessionId: record.id,
    projectId: record.projectId,
    chapterNumber: record.chapterNumber,
    status: record.status,
    triggerReason: record.triggerReason,
    updatedAt: record.updatedAt
  };
}

function toSessionDetail(record: {
  id: string;
  projectId: string;
  chapterNumber: number;
  status: string;
  triggerReason: string | null;
  updatedAt: Date | string;
  packet: Record<string, unknown>;
  messages: Array<Record<string, unknown>>;
  resolution: Record<string, unknown> | null;
  currentDraftResolution?: Record<string, unknown> | null;
}) {
  return {
    ...toSessionSummary(record),
    packet: record.packet,
    messages: record.messages,
    resolution: record.resolution,
    currentDraftResolution: record.currentDraftResolution ?? null,
    confirmation: record.currentDraftResolution
      ? {
          required: true,
          requestType: 'confirm_resolution' as const
        }
      : null
  };
}

export function registerDecisionSessionRoutes(app: FastifyInstance) {
  const projectRepository = new ProjectRepository();
  const decisionSessionRepository = new DecisionSessionRepository();

  app.get('/decision-sessions', async () => {
    const sessions = await projectRepository.getDecisionQueue();

    return {
      items: sessions.map(toSessionSummary)
    };
  });

  app.get('/decision-sessions/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = await decisionSessionRepository.getSessionDetail(sessionId);

    if (!session) {
      return {
        message: 'Decision session not found'
      };
    }

    return toSessionDetail(session as never);
  });

  app.post('/decision-sessions/:sessionId/messages', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const payload = parseDecisionMessagePayload(request.body);

    if (!payload) {
      return reply.code(400).send({
        message: 'Invalid decision message payload'
      });
    }

    const appendedMessage = await decisionSessionRepository.appendMessage({
      sessionId,
      sequence: 0,
      role: 'human',
      messageType: 'human',
      content: payload.content
    });

    return reply.code(201).send({
      sessionId,
      status: 'awaiting_assistant_reply',
      appendedMessage,
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

    await decisionSessionRepository.saveDraftResolution(sessionId, resolution);

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

    await decisionSessionRepository.saveResolution({
      sessionId,
      ...payload
    });

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
