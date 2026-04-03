import type { ExportFormat, PublishProfile } from '@novel-creator/domain';
import { prisma } from '../client';

type PublishTaskRecordLike = {
  id: string;
  projectId: string;
  chapterNumber: number;
  targetPlatform: string;
  mode: 'adapter_publish' | 'manual_export';
  status: string;
  payloadSnapshot: Record<string, unknown>;
  artifactId: string | null;
  attemptCount: number;
  lastError: string | null;
};

function normalizeTargets(targets: unknown): string[] {
  if (!Array.isArray(targets)) {
    return [];
  }

  return [
    ...new Set(
      targets.filter((target): target is string => typeof target === 'string' && target.length > 0)
    )
  ];
}

function assertNoTargetOverlap(projectId: string, autoTargets: string[], manualTargets: string[]) {
  const overlap = autoTargets.filter((target) => manualTargets.includes(target));

  if (overlap.length > 0) {
    throw new Error(
      `Publish target overlap for project ${projectId}: ${overlap.join(', ')}`
    );
  }
}

function assertManualExportTask(task: PublishTaskRecordLike | null, publishTaskId: string) {
  if (!task) {
    throw new Error(`Publish task ${publishTaskId} not found`);
  }

  if (task.mode !== 'manual_export') {
    throw new Error(
      `Publish task ${publishTaskId} is not a manual_export task`
    );
  }

  return task;
}

export class PublishRepository {
  async getPublishProfile(projectId: string): Promise<PublishProfile | null> {
    const profile = await prisma.publishProfileRecord.findUnique({
      where: { projectId }
    });

    if (!profile) {
      return null;
    }

    return {
      projectId: profile.projectId,
      publishEnabled: profile.publishEnabled,
      autoPublishTargets: normalizeTargets(profile.autoPublishTargets),
      manualExportTargets: normalizeTargets(profile.manualExportTargets),
      defaultExportFormat: profile.defaultExportFormat as ExportFormat,
      effectiveFromChapter: profile.effectiveFromChapter
    };
  }

  async upsertPublishProfile(profile: PublishProfile) {
    const autoPublishTargets = normalizeTargets(profile.autoPublishTargets);
    const manualExportTargets = normalizeTargets(profile.manualExportTargets);

    assertNoTargetOverlap(profile.projectId, autoPublishTargets, manualExportTargets);

    return prisma.publishProfileRecord.upsert({
      where: { projectId: profile.projectId },
      create: {
        ...profile,
        autoPublishTargets,
        manualExportTargets
      },
      update: {
        ...profile,
        autoPublishTargets,
        manualExportTargets
      }
    });
  }

  async createPublishTasks(input: {
    projectId: string;
    chapterNumber: number;
    payloadSnapshot: Record<string, unknown>;
  }) {
    const profile = await prisma.publishProfileRecord.findUnique({
      where: { projectId: input.projectId }
    });

    if (!profile || !profile.publishEnabled) {
      return [];
    }

    const autoTargets = normalizeTargets(profile.autoPublishTargets);
    const exportTargets = normalizeTargets(profile.manualExportTargets);

    assertNoTargetOverlap(profile.projectId, autoTargets, exportTargets);

    if (
      profile.effectiveFromChapter !== null &&
      input.chapterNumber < profile.effectiveFromChapter
    ) {
      return [];
    }

    return prisma.$transaction(async (tx) => {
      await Promise.all([
        ...autoTargets.map((target) =>
          tx.publishTaskRecord.upsert({
            where: {
              projectId_chapterNumber_targetPlatform_mode: {
                projectId: input.projectId,
                chapterNumber: input.chapterNumber,
                targetPlatform: target,
                mode: 'adapter_publish'
              }
            },
            create: {
              projectId: input.projectId,
              chapterNumber: input.chapterNumber,
              targetPlatform: target,
              mode: 'adapter_publish',
              status: 'pending',
              payloadSnapshot: input.payloadSnapshot
            },
            update: {}
          })
        ),
        ...exportTargets.map((target) =>
          tx.publishTaskRecord.upsert({
            where: {
              projectId_chapterNumber_targetPlatform_mode: {
                projectId: input.projectId,
                chapterNumber: input.chapterNumber,
                targetPlatform: target,
                mode: 'manual_export'
              }
            },
            create: {
              projectId: input.projectId,
              chapterNumber: input.chapterNumber,
              targetPlatform: target,
              mode: 'manual_export',
              status: 'pending',
              payloadSnapshot: input.payloadSnapshot
            },
            update: {}
          })
        )
      ]);

      return tx.publishTaskRecord.findMany({
        where: {
          projectId: input.projectId,
          chapterNumber: input.chapterNumber
        },
        orderBy: [{ targetPlatform: 'asc' }, { mode: 'asc' }]
      });
    });
  }

  async listPublishTasks() {
    return prisma.publishTaskRecord.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
  }

  async listExportArtifacts() {
    return prisma.exportArtifactRecord.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });
  }

  async createExportArtifact(input: {
    projectId: string;
    chapterNumber: number;
    targetPlatform: string;
    format: ExportFormat;
    content: string;
  }) {
    return prisma.exportArtifactRecord.create({
      data: input
    });
  }

  async markManualExportReady(input: {
    publishTaskId: string;
    artifactId: string;
  }) {
    const task = assertManualExportTask(
      await prisma.publishTaskRecord.findUnique({
        where: { id: input.publishTaskId }
      }),
      input.publishTaskId
    );

    if (task.status === 'pending') {
      return prisma.publishTaskRecord.update({
        where: { id: input.publishTaskId },
        data: {
          status: 'manual_upload_pending',
          artifactId: input.artifactId,
          lastError: null
        }
      });
    }

    if (task.status === 'manual_upload_pending' || task.status === 'manual_upload_confirmed') {
      if (task.artifactId === input.artifactId) {
        return task;
      }

      throw new Error(
        `Publish task ${input.publishTaskId} already references artifact ${task.artifactId ?? 'none'}`
      );
    }

    throw new Error(
      `Publish task ${input.publishTaskId} is not ready for manual export from state ${task.status}`
    );
  }

  async confirmManualUpload(publishTaskId: string) {
    const task = assertManualExportTask(
      await prisma.publishTaskRecord.findUnique({
        where: { id: publishTaskId }
      }),
      publishTaskId
    );

    if (task.status === 'manual_upload_confirmed') {
      if (task.artifactId !== null) {
        return task;
      }

      throw new Error(`Publish task ${publishTaskId} is confirmed without an artifact binding`);
    }

    if (task.status !== 'manual_upload_pending') {
      throw new Error(
        `Publish task ${publishTaskId} is not ready for manual upload from state ${task.status}`
      );
    }

    if (task.artifactId === null) {
      throw new Error(`Publish task ${publishTaskId} is ready without an artifact binding`);
    }

    return prisma.publishTaskRecord.update({
      where: { id: publishTaskId },
      data: {
        status: 'manual_upload_confirmed',
        artifactId: task.artifactId,
        lastError: null
      }
    });
  }
}
