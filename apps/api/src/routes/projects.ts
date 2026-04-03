import type { FastifyInstance } from 'fastify';
import { createNovelProject } from '../../../../packages/domain/src';

function toIsoString(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? null;
}

async function getProjectRepository() {
  const { ProjectRepository } = await import(
    '../../../../packages/storage/src/repositories/project-repository'
  );

  return new ProjectRepository();
}

export function registerProjectRoutes(app: FastifyInstance) {
  app.post('/projects', async (request, reply) => {
    const repository = await getProjectRepository();
    const project = createNovelProject(request.body as any);
    const savedProject = await repository.create(project);

    return reply.code(201).send(savedProject);
  });

  app.get('/projects/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const repository = await getProjectRepository();
    const detail = await repository.getProjectDecisionAndPublishingDetail(projectId);

    if (!detail) {
      return reply.code(404).send({
        message: 'Project not found'
      });
    }

    const latestReviewDecisionByChapter = new Map<number, string>();

    for (const reviewOutcome of detail.reviewOutcomeRecords) {
      const payload = reviewOutcome.payload as { decision?: string } | null;

      if (payload?.decision && typeof payload.decision === 'string') {
        latestReviewDecisionByChapter.set(reviewOutcome.chapterNumber, payload.decision);
      }
    }

    return {
      projectId: detail.id,
      outline: detail.storyState?.outline ?? null,
      volumePlans: detail.storyState?.volumePlans ?? [],
      chapters: detail.chapterStateRecords.map((chapter) => ({
        chapterNumber: chapter.chapterNumber,
        status: chapter.status,
        latestReviewDecision: latestReviewDecisionByChapter.get(chapter.chapterNumber) ?? null
      })),
      recentAgentRuns: detail.agentRunRecords.map((run) => ({
        ...run,
        createdAt: toIsoString((run as { createdAt?: Date | string }).createdAt)
      })),
      publishProfile: detail.publishProfile
        ? {
            publishEnabled: detail.publishProfile.publishEnabled,
            autoPublishTargets: detail.publishProfile.autoPublishTargets,
            manualExportTargets: detail.publishProfile.manualExportTargets,
            defaultExportFormat: detail.publishProfile.defaultExportFormat,
            effectiveFromChapter: detail.publishProfile.effectiveFromChapter
          }
        : {
            publishEnabled: false,
            autoPublishTargets: [],
            manualExportTargets: [],
            defaultExportFormat: 'markdown',
            effectiveFromChapter: null
          }
    };
  });
}
