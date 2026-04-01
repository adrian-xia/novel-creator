import type { ExportFormat, PublishProfile } from '@novel-creator/domain';
import { prisma } from '../client';

export class PublishRepository {
  async upsertPublishProfile(profile: PublishProfile) {
    return prisma.publishProfileRecord.upsert({
      where: { projectId: profile.projectId },
      create: profile,
      update: profile
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

    if (
      profile.effectiveFromChapter !== null &&
      input.chapterNumber < profile.effectiveFromChapter
    ) {
      return [];
    }

    const autoTargets = Array.isArray(profile.autoPublishTargets) ? profile.autoPublishTargets : [];
    const exportTargets = Array.isArray(profile.manualExportTargets)
      ? profile.manualExportTargets
      : [];

    return prisma.$transaction(async (tx) => {
      const tasks = [
        ...autoTargets.map((target) =>
          tx.publishTaskRecord.create({
            data: {
              projectId: input.projectId,
              chapterNumber: input.chapterNumber,
              targetPlatform: String(target),
              mode: 'adapter_publish',
              status: 'pending',
              payloadSnapshot: input.payloadSnapshot
            }
          })
        ),
        ...exportTargets.map((target) =>
          tx.publishTaskRecord.create({
            data: {
              projectId: input.projectId,
              chapterNumber: input.chapterNumber,
              targetPlatform: String(target),
              mode: 'manual_export',
              status: 'pending',
              payloadSnapshot: input.payloadSnapshot
            }
          })
        )
      ];

      return Promise.all(tasks);
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
}
