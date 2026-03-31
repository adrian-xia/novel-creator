import { describe, expect, it } from 'vitest';
import { CapacityService } from '../../packages/llm-gateway/src/capacity-service';

describe('CapacityService', () => {
  it('leases the highest-priority available key', async () => {
    const service = new CapacityService([
      {
        id: 'key-a',
        provider: 'openai',
        model: 'gpt-5-mini',
        priority: 10,
        enabled: true,
        maxConcurrentRequests: 2,
        currentLeases: 0
      },
      {
        id: 'key-b',
        provider: 'openai',
        model: 'gpt-5-mini',
        priority: 1,
        enabled: true,
        maxConcurrentRequests: 2,
        currentLeases: 0
      }
    ]);

    const lease = await service.acquire({
      provider: 'openai',
      model: 'gpt-5-mini'
    });

    expect(lease.keyId).toBe('key-a');
  });
});
