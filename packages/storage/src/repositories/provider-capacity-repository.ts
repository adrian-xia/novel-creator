import type { ProviderCapacity } from '@novel-creator/domain';
import { prisma } from '../client';

export class ProviderCapacityRepository {
  async create(providerCapacity: ProviderCapacity): Promise<ProviderCapacity> {
    return prisma.providerCapacity.create({
      data: providerCapacity
    });
  }
}
