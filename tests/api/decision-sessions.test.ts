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
});
