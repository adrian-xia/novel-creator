import type { FastifyInstance } from 'fastify';
import { buildDecisionResolutionDraft } from '../../../../packages/agent-runtime/src/decision-resolution-draft';
import {
  parseDecisionMessagePayload,
  parseDecisionResolutionDraftPayload,
  parseDecisionResolutionPayload
} from './validation';
import {
  chapterReplanFlow,
  decisionSessionFlow,
  enqueueWorkflow
} from '../../../../packages/workflows/src';

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
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt
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
    messages: record.messages.map((message) => ({
      ...message,
      createdAt:
        message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt
    })),
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

async function getProjectRepository() {
  const { ProjectRepository } = await import(
    '../../../../packages/storage/src/repositories/project-repository'
  );
  return new ProjectRepository();
}

async function getDecisionSessionRepository() {
  const { DecisionSessionRepository } = await import(
    '../../../../packages/storage/src/repositories/decision-session-repository'
  );
  return new DecisionSessionRepository();
}

export function registerDecisionSessionRoutes(app: FastifyInstance) {
  app.get('/decision-sessions', async () => {
    const projectRepository = await getProjectRepository();
    const sessions = await projectRepository.getDecisionQueue();

    return {
      items: sessions.map(toSessionSummary)
    };
  });

  app.get('/decision-sessions/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const decisionSessionRepository = await getDecisionSessionRepository();
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
    const decisionSessionRepository = await getDecisionSessionRepository();
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
      appendedMessage: {
        ...appendedMessage,
        createdAt:
          appendedMessage.createdAt instanceof Date
            ? appendedMessage.createdAt.toISOString()
            : appendedMessage.createdAt
      },
      assistantWork: enqueueWorkflow(decisionSessionFlow())
    });
  });

  app.post('/decision-sessions/:sessionId/generate-resolution', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const decisionSessionRepository = await getDecisionSessionRepository();
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

    const session = await decisionSessionRepository.saveDraftResolution(sessionId, resolution);

    return reply.code(200).send({
      sessionId,
      status: session.status,
      resolution,
      confirmation: {
        required: true,
        requestType: 'confirm_resolution'
      }
    });
  });

  app.post('/decision-sessions/:sessionId/resolve', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const decisionSessionRepository = await getDecisionSessionRepository();
    const payload = parseDecisionResolutionPayload(request.body);

    if (!payload) {
      return reply.code(400).send({
        message: 'Invalid decision resolution payload'
      });
    }

    const session = await decisionSessionRepository.saveResolution({
      sessionId,
      ...payload
    });

    return reply.code(200).send({
      sessionId,
      status: session.status,
      resolution: {
        sessionId,
        ...payload
      },
      recoveryWork:
        payload.nextAction === 'replan_window'
          ? enqueueWorkflow(chapterReplanFlow())
          : null
    });
  });
}
