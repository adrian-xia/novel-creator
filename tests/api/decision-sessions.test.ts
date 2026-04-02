import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('decision session routes', () => {
  afterEach(async () => {
    await buildApp().close();
  });

  it('returns a decision queue response', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/decision-sessions'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });

  it('rejects an invalid decision message payload', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-123/messages',
      payload: {
        role: 'human',
        messageType: 'human'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Invalid decision message payload'
    });
  });
});
