import { describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('provider capacity route', () => {
  it('creates a provider capacity record', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/provider-capacity',
      payload: {
        provider: 'openai',
        model: 'gpt-5.4',
        keyName: 'primary',
        secretRef: 'vault://openai/primary',
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

    expect(body).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4',
      keyName: 'primary',
      secretRef: 'vault://openai/primary',
      maxConcurrentRequests: 8,
      requestsPerMinute: 120,
      tokensPerMinute: 240000,
      dailyBudget: '50.00',
      enabled: true,
      priority: 1
    });
    expect(body.id).toEqual(expect.any(String));
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
});
