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

  async listAll(): Promise<PromptConfig[]> {
    return prisma.promptConfig.findMany({
      orderBy: [{ agentName: 'asc' }, { version: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async upsert(promptConfig: PromptConfig): Promise<PromptConfig> {
    return prisma.promptConfig.upsert({
      where: {
        agentName_version: {
          agentName: promptConfig.agentName,
          version: promptConfig.version
        }
      },
      create: promptConfig,
      update: {
        systemPrompt: promptConfig.systemPrompt,
        taskTemplate: promptConfig.taskTemplate,
        outputSchema: promptConfig.outputSchema,
        reviewRubric: promptConfig.reviewRubric,
        enabled: promptConfig.enabled,
        lastTestedModel: promptConfig.lastTestedModel
      }
    });
  }
}
