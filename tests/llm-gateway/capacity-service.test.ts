import { describe, expect, it } from 'vitest';
import { CapacityService } from '../../packages/llm-gateway/src/capacity-service';

describe('CapacityService', () => {
  it('leases the highest-priority available key', async () => {
    const service = new CapacityService([
      {
        id: 'key-a',
        provider: 'openai',
        model: 'gpt-5-mini',
        keyName: 'primary',
        secretRef: 'openai/key-a',
        priority: 10,
        enabled: true,
        maxConcurrentRequests: 2,
        requestsPerMinute: 120,
        tokensPerMinute: 120000,
        dailyBudget: '100.00',
        currentLeases: 0
      },
      {
        id: 'key-b',
        provider: 'openai',
        model: 'gpt-5-mini',
        keyName: 'secondary',
        secretRef: 'openai/key-b',
        priority: 1,
        enabled: true,
        maxConcurrentRequests: 2,
        requestsPerMinute: 120,
        tokensPerMinute: 120000,
        dailyBudget: '100.00',
        currentLeases: 0
      }
    ]);

    const lease = await service.acquire({
      provider: 'openai',
      model: 'gpt-5-mini'
    });

    expect(lease.keyId).toBe('key-a');
  });

  it('releases a lease so exhausted capacity becomes available again', async () => {
    const service = new CapacityService([
      {
        id: 'key-a',
        provider: 'openai',
        model: 'gpt-5-mini',
        keyName: 'primary',
        secretRef: 'openai/key-a',
        priority: 10,
        enabled: true,
        maxConcurrentRequests: 1,
        requestsPerMinute: 120,
        tokensPerMinute: 120000,
        dailyBudget: '100.00',
        currentLeases: 0
      }
    ]);

    const lease = await service.acquire({
      provider: 'openai',
      model: 'gpt-5-mini'
    });

    await expect(
      service.acquire({
        provider: 'openai',
        model: 'gpt-5-mini'
      })
    ).rejects.toThrow('No capacity for openai/gpt-5-mini');

    await service.release(lease);

    await expect(
      service.acquire({
        provider: 'openai',
        model: 'gpt-5-mini'
      })
    ).resolves.toEqual({ keyId: 'key-a' });
  });

  it('rejects releasing a key that is not currently leased', async () => {
    const service = new CapacityService([
      {
        id: 'key-a',
        provider: 'openai',
        model: 'gpt-5-mini',
        keyName: 'primary',
        secretRef: 'openai/key-a',
        priority: 10,
        enabled: true,
        maxConcurrentRequests: 1,
        requestsPerMinute: 120,
        tokensPerMinute: 120000,
        dailyBudget: '100.00',
        currentLeases: 0
      }
    ]);

    await expect(service.release({ keyId: 'key-a' })).rejects.toThrow(
      'Lease not found for key-a'
    );
  });
});
