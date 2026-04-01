import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('workflow run routes', () => {
  afterEach(async () => {
    await buildApp().close();
  });

  it('returns workflow runs', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/workflow-runs'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });
});
