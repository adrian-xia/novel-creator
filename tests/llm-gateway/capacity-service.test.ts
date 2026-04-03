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
        baseUrl: 'https://relay.example.com/v1',
        apiKeySecretRef: 'vault://relay/openai-compatible-a',
        protocolMode: 'auto',
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
        baseUrl: 'https://relay.example.com/v1',
        apiKeySecretRef: 'vault://relay/openai-compatible-b',
        protocolMode: 'responses',
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

    expect(lease).toMatchObject({
      keyId: 'key-a',
      baseUrl: 'https://relay.example.com/v1',
      apiKeySecretRef: 'vault://relay/openai-compatible-a',
      protocolMode: 'auto'
    });
    expect(lease.leaseId).toMatch(/^lease-/);
  });

  it('releases a lease so exhausted capacity becomes available again', async () => {
    const service = new CapacityService([
      {
        id: 'key-a',
        provider: 'openai',
        model: 'gpt-5-mini',
        keyName: 'primary',
        baseUrl: 'https://relay.example.com/v1',
        apiKeySecretRef: 'vault://relay/openai-compatible',
        protocolMode: 'auto',
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
    ).resolves.toMatchObject({ keyId: 'key-a' });
  });

  it('rejects releasing a key that is not currently leased', async () => {
    const service = new CapacityService([
      {
        id: 'key-a',
        provider: 'openai',
        model: 'gpt-5-mini',
        keyName: 'primary',
        baseUrl: 'https://relay.example.com/v1',
        apiKeySecretRef: 'vault://relay/openai-compatible',
        protocolMode: 'chat_completions',
        priority: 10,
        enabled: true,
        maxConcurrentRequests: 1,
        requestsPerMinute: 120,
        tokensPerMinute: 120000,
        dailyBudget: '100.00',
        currentLeases: 0
      }
    ]);

    await expect(service.release({ keyId: 'key-a', leaseId: 'lease-missing' })).rejects.toThrow(
      'Lease not found for key-a'
    );
  });

  it('tracks unique lease identities and rejects duplicate release of the same lease', async () => {
    const service = new CapacityService([
      {
        id: 'key-a',
        provider: 'openai',
        model: 'gpt-5-mini',
        keyName: 'primary',
        baseUrl: 'https://relay.example.com/v1',
        apiKeySecretRef: 'vault://relay/openai-compatible',
        protocolMode: 'auto',
        priority: 10,
        enabled: true,
        maxConcurrentRequests: 2,
        requestsPerMinute: 120,
        tokensPerMinute: 120000,
        dailyBudget: '100.00',
        currentLeases: 0
      }
    ]);

    const firstLease = await service.acquire({
      provider: 'openai',
      model: 'gpt-5-mini'
    });
    const secondLease = await service.acquire({
      provider: 'openai',
      model: 'gpt-5-mini'
    });

    expect(firstLease.keyId).toBe('key-a');
    expect(secondLease.keyId).toBe('key-a');
    expect(firstLease.leaseId).not.toBe(secondLease.leaseId);

    await service.release(firstLease);

    await expect(service.release(firstLease)).rejects.toThrow('Lease not found for key-a');

    const thirdLease = await service.acquire({
      provider: 'openai',
      model: 'gpt-5-mini'
    });

    await expect(
      service.acquire({
        provider: 'openai',
        model: 'gpt-5-mini'
      })
    ).rejects.toThrow('No capacity for openai/gpt-5-mini');

    await service.release(secondLease);
    await service.release(thirdLease);

    await expect(
      service.acquire({
        provider: 'openai',
        model: 'gpt-5-mini'
      })
    ).resolves.toMatchObject({ keyId: 'key-a' });
  });
});
