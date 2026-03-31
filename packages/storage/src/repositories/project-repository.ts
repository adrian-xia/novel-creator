import type { NovelProject } from '@novel-creator/domain';
import { prisma } from '../client';

export class ProjectRepository {
  async create(project: NovelProject): Promise<NovelProject> {
    return prisma.novelProject.create({
      data: project
    });
  }
}
