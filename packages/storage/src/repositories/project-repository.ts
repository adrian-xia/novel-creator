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

  async exists(id: string): Promise<boolean> {
    const project = await prisma.novelProject.findUnique({
      where: { id }
    });

    return project !== null;
  }
}
