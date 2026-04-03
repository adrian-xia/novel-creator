import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderCapacity } from '../../packages/domain/src/provider-capacity';

const createProviderCapacityRecord = vi.fn();

vi.mock('../../packages/storage/src/client', () => ({
  prisma: {
    providerCapacity: {
      create: createProviderCapacityRecord
    }
  }
}));

describe('provider capacity repository contracts', () => {
  beforeEach(() => {
    createProviderCapacityRecord.mockReset();
  });

  it('persists a provider capacity record through prisma', async () => {
    const { ProviderCapacityRepository } = await import(
      '../../packages/storage/src/repositories/provider-capacity-repository'
    );

    const providerCapacity: ProviderCapacity = {
      id: 'provider-capacity-1',
      provider: 'openai',
      model: 'gpt-5.4',
      keyName: 'primary',
      baseUrl: 'https://relay.example.com/v1',
      apiKeySecretRef: 'vault://relay/openai-compatible',
      protocolMode: 'auto',
      maxConcurrentRequests: 8,
      requestsPerMinute: 120,
      tokensPerMinute: 240000,
      dailyBudget: '50.00',
      enabled: true,
      priority: 1
    };

    createProviderCapacityRecord.mockResolvedValue(providerCapacity);

    await expect(new ProviderCapacityRepository().create(providerCapacity)).resolves.toEqual(
      providerCapacity
    );
    expect(createProviderCapacityRecord).toHaveBeenCalledWith({
      data: providerCapacity
    });
  });
});
