import type { ExportFormat, PublishProfile } from '@novel-creator/domain';
import { prisma } from '../client';

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

export class PublishRepository {
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
    return prisma.publishTaskRecord.update({
      where: { id: input.publishTaskId },
      data: {
        status: 'manual_upload_pending',
        artifactId: input.artifactId
      }
    });
  }

  async confirmManualUpload(publishTaskId: string) {
    return prisma.publishTaskRecord.update({
      where: { id: publishTaskId },
      data: { status: 'manual_upload_confirmed' }
    });
  }
}
