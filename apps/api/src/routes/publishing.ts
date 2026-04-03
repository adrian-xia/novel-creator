import type { FastifyInstance } from 'fastify';
import { parsePublishProfilePayload } from './validation';

type PublishProfileResponse = {
  projectId: string;
  publishEnabled: boolean;
  autoPublishTargets: string[];
  manualExportTargets: string[];
  defaultExportFormat: 'plain_text' | 'markdown' | 'bundle';
  effectiveFromChapter: number | null;
};

function normalizeTargets(targets: unknown): string[] {
  if (!Array.isArray(targets)) {
    return [];
  }

  return targets.filter((target): target is string => typeof target === 'string');
}

function toPublishProfileResponse(
  projectId: string,
  profile: {
    projectId: string;
    publishEnabled: boolean;
    autoPublishTargets: unknown;
    manualExportTargets: unknown;
    defaultExportFormat: string;
    effectiveFromChapter: number | null;
  } | null
): PublishProfileResponse {
  if (!profile) {
    return {
      projectId,
      publishEnabled: false,
      autoPublishTargets: [],
      manualExportTargets: [],
      defaultExportFormat: 'markdown',
      effectiveFromChapter: null
    };
  }

  return {
    projectId: profile.projectId,
    publishEnabled: profile.publishEnabled,
    autoPublishTargets: normalizeTargets(profile.autoPublishTargets),
    manualExportTargets: normalizeTargets(profile.manualExportTargets),
    defaultExportFormat: profile.defaultExportFormat as PublishProfileResponse['defaultExportFormat'],
    effectiveFromChapter: profile.effectiveFromChapter
  };
}

function toIsoString(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? null;
}

async function getPublishRepository() {
  const { PublishRepository } = await import(
    '../../../../packages/storage/src/repositories/publish-repository'
  );

  return new PublishRepository();
}

export function registerPublishingRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/publish-profile', async (request) => {
    const { projectId } = request.params as { projectId: string };
    try {
      const repository = await getPublishRepository();
      const profile = await repository.getPublishProfile(projectId);

      return toPublishProfileResponse(projectId, profile);
    } catch {
      return toPublishProfileResponse(projectId, null);
    }
  });

  app.put('/projects/:projectId/publish-profile', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = parsePublishProfilePayload(request.body);

    if (!payload) {
      return reply.code(400).send({ error: 'Invalid publish profile payload' });
    }

    const repository = await getPublishRepository();
    await repository.upsertPublishProfile({
      projectId,
      ...payload
    });

    return {
      projectId,
      ...payload
    };
  });

  app.get('/publish-tasks', async () => {
    try {
      const repository = await getPublishRepository();
      const [tasks, artifacts] = await Promise.all([
        repository.listPublishTasks(),
        repository.listExportArtifacts()
      ]);

      return {
        items: tasks.map((task) => ({
          ...task,
          createdAt: toIsoString((task as { createdAt?: Date | string }).createdAt),
          updatedAt: toIsoString((task as { updatedAt?: Date | string }).updatedAt)
        })),
        artifacts: artifacts.map((artifact) => ({
          ...artifact,
          createdAt: toIsoString((artifact as { createdAt?: Date | string }).createdAt)
        }))
      };
    } catch {
      return {
        items: [],
        artifacts: []
      };
    }
  });

  app.post('/publish-tasks/:taskId/manual-upload-confirm', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    try {
      const repository = await getPublishRepository();
      const task = await repository.confirmManualUpload(taskId);

      return {
        taskId,
        status: task.status
      };
    } catch {
      return reply.code(400).send({
        error: 'Invalid manual upload confirmation'
      });
    }
  });
}
