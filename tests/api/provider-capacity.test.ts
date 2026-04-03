import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

const createProviderCapacityRecordMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/provider-capacity-repository', () => ({
  ProviderCapacityRepository: class {
    create = createProviderCapacityRecordMock;
  }
}));

describe('provider capacity route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a provider capacity record', async () => {
    createProviderCapacityRecordMock.mockResolvedValue({
      id: 'provider-capacity-persisted',
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
    });

    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/provider-capacity',
      payload: {
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
      }
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body).toEqual({
      id: 'provider-capacity-persisted',
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
    });
    expect(createProviderCapacityRecordMock).toHaveBeenCalledTimes(1);
    expect(createProviderCapacityRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
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
        priority: 1,
        id: expect.any(String)
      })
    );
  });

  it('rejects an invalid provider capacity payload', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/provider-capacity',
      payload: {
        provider: 'openai',
        model: 'gpt-5.4',
        keyName: 'primary',
        secretRef: 'vault://openai/primary',
        maxConcurrentRequests: '8',
        requestsPerMinute: 120,
        tokensPerMinute: 240000,
        dailyBudget: '50.00',
        enabled: true,
        priority: 1
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid provider capacity payload'
    });
  });

  it('rejects an empty base URL', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/provider-capacity',
      payload: {
        provider: 'openai',
        model: 'gpt-5.4',
        keyName: 'primary',
        baseUrl: '',
        apiKeySecretRef: 'vault://openai/primary',
        protocolMode: 'responses',
        maxConcurrentRequests: 8,
        requestsPerMinute: 120,
        tokensPerMinute: 240000,
        dailyBudget: '50.00',
        enabled: true,
        priority: 1
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid provider capacity payload'
    });
  });

  it('rejects an invalid protocol mode', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/provider-capacity',
      payload: {
        provider: 'openai',
        model: 'gpt-5.4',
        keyName: 'primary',
        baseUrl: 'https://relay.example.com/v1',
        apiKeySecretRef: 'vault://openai/primary',
        protocolMode: 'json_mode',
        maxConcurrentRequests: 8,
        requestsPerMinute: 120,
        tokensPerMinute: 240000,
        dailyBudget: '50.00',
        enabled: true,
        priority: 1
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid provider capacity payload'
    });
  });

  it('rejects an empty api key secret ref', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/provider-capacity',
      payload: {
        provider: 'openai',
        model: 'gpt-5.4',
        keyName: 'primary',
        baseUrl: 'https://relay.example.com/v1',
        apiKeySecretRef: '',
        protocolMode: 'responses',
        maxConcurrentRequests: 8,
        requestsPerMinute: 120,
        tokensPerMinute: 240000,
        dailyBudget: '50.00',
        enabled: true,
        priority: 1
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid provider capacity payload'
    });
  });
});
