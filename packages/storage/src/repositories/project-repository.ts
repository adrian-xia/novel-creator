import type { NovelProject } from '@novel-creator/domain';
import { prisma } from '../client';

export class ProjectRepository {
  async create(project: NovelProject): Promise<NovelProject> {
    return prisma.novelProject.create({
      data: project
    });
  }

  async findById(id: string): Promise<NovelProject | null> {
    return prisma.novelProject.findUnique({
      where: { id }
    });
  }

  async findByIdWithStoryState(id: string) {
    return prisma.novelProject.findUnique({
      where: { id },
      include: {
        storyState: true
      }
    });
  }

  async exists(id: string): Promise<boolean> {
    const project = await prisma.novelProject.findUnique({
      where: { id }
    });

    return project !== null;
  }

  async getDecisionQueue() {
    return prisma.decisionSessionRecord.findMany({
      where: {
        status: {
          notIn: ['resolved', 'cancelled']
        }
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        project: true
      }
    });
  }

  async getProjectDecisionAndPublishingDetail(projectId: string) {
    return prisma.novelProject.findUnique({
      where: { id: projectId },
      include: {
        storyState: true,
        chapterStateRecords: true,
        reviewOutcomeRecords: true,
        agentRunRecords: { orderBy: { createdAt: 'desc' }, take: 10 },
        publishProfile: true,
        publishTaskRecords: { orderBy: { createdAt: 'desc' }, take: 20 },
        decisionSessions: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
            resolution: true
          }
        }
      }
    });
  }
}
