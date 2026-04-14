import { describe, expect, it, vi } from 'vitest';
import { POST } from '../../apps/web/src/app/prompts/bootstrap/route';

describe('prompt bootstrap web route', () => {
  it('proxies prompt bootstrap submissions to the API and redirects back to the prompts page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      new Request('http://localhost/prompts/bootstrap', {
        method: 'POST'
      })
    );

    expect(response.status).toBe(303);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/prompts/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
  });
});
