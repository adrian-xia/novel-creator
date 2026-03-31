import type { NovelProject } from '../../../domain/src/novel-project';
import { prisma } from '../client';

export class ProjectRepository {
  async create(project: NovelProject): Promise<NovelProject> {
    return prisma.novelProject.create({
      data: project
    });
  }
}
