import type { PromptConfig } from '@novel-creator/domain';
import { prisma } from '../client';

export class PromptRepository {
  async create(promptConfig: PromptConfig): Promise<PromptConfig> {
    return prisma.promptConfig.create({
      data: promptConfig
    });
  }

  async findLatestEnabledByAgentName(agentName: string): Promise<PromptConfig | null> {
    return prisma.promptConfig.findFirst({
      where: { agentName, enabled: true },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
    });
  }
}
