import { describe, expect, it, vi } from 'vitest';
import { POST } from '../../apps/web/src/app/projects/[projectId]/continue/route';

describe('project continue web route', () => {
  it('proxies project continue submissions to the API and redirects back to the project page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      new Request('http://localhost/projects/project-1/continue', {
        method: 'POST'
      }),
      { params: Promise.resolve({ projectId: 'project-1' }) }
    );

    expect(response.status).toBe(303);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/projects/project-1/continue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
  });
});
