import type { PromptConfig } from '../../../domain/src/prompt-config';
import { prisma } from '../client';

export class PromptRepository {
  async create(promptConfig: PromptConfig): Promise<PromptConfig> {
    return prisma.promptConfig.create({
      data: promptConfig
    });
  }
}
