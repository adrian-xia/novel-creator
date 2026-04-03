import { describe, expect, it, vi } from 'vitest';
import { POST } from '../../apps/web/src/app/publish/export/route';

describe('export download route', () => {
  it('proxies the export request to the API and returns the file response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': 'attachment; filename="project-1-chapters-8.md"'
        }),
        arrayBuffer: async () => new TextEncoder().encode('# Chapter Eight').buffer
      })
    );

    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('format', 'markdown');
    formData.append('chapterNumber', '8');

    const response = await POST(
      new Request('http://localhost/publish/export', {
        method: 'POST',
        body: formData
      })
    );

    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(response.headers.get('content-disposition')).toContain('project-1-chapters-8.md');
  });
});
