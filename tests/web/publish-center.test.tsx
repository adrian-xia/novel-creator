import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PublishCenterPage from '../../apps/web/src/app/publish/page';

describe('PublishCenterPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders export batch controls and markdown preview for the selected project', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'task-1',
              targetPlatform: 'alpha',
              status: 'published'
            }
          ],
          artifacts: [
            {
              id: 'artifact-1',
              targetPlatform: 'beta',
              format: 'bundle'
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              projectId: 'project-1',
              chapterNumber: 8,
              title: 'Chapter Eight',
              summary: 'The trap closes.',
              updatedAt: '2026-04-03T00:00:00.000Z'
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projectId: 'project-1',
          chapterNumbers: [8],
          format: 'markdown',
          chapterCount: 1,
          content: '# Chapter Eight\n\nBody',
          chapterSummaries: []
        })
      });

    const Page = await PublishCenterPage({
      searchParams: Promise.resolve({
        projectId: 'project-1',
        chapterNumbers: ['8'],
        format: 'markdown',
        preview: '1'
      })
    } as never);
    const html = renderToString(Page);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/publish-tasks', undefined);
    expect(html).toContain('Publish Center');
    expect(html).toContain('Export Batch');
    expect(html).toContain('Chapter Eight');
    expect(html).toContain('# Chapter Eight');
    expect(html).toContain('task-1');
    expect(html).toContain('artifact-1');
  });

  it('renders bundle preview metadata for the selected project', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'task-1',
              targetPlatform: 'alpha',
              status: 'published'
            }
          ],
          artifacts: [
            {
              id: 'artifact-1',
              targetPlatform: 'beta',
              format: 'bundle'
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              projectId: 'project-1',
              chapterNumber: 8,
              title: 'Chapter Eight',
              summary: 'The trap closes.',
              updatedAt: '2026-04-03T00:00:00.000Z'
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projectId: 'project-1',
          chapterNumbers: [8],
          format: 'bundle',
          chapterCount: 1,
          files: ['manuscript.md', 'manifest.json', 'chapter-summaries.json'],
          manifest: {
            projectId: 'project-1',
            exportedAt: '2026-04-03T00:00:00.000Z'
          },
          chapterSummaries: [
            {
              chapterNumber: 8,
              title: 'Chapter Eight',
              summary: 'The trap closes.',
              wordCount: 1
            }
          ]
        })
      });

    const Page = await PublishCenterPage({
      searchParams: Promise.resolve({
        projectId: 'project-1',
        chapterNumbers: ['8'],
        format: 'bundle',
        preview: '1'
      })
    } as never);
    const html = renderToString(Page);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/publish-tasks', undefined);
    expect(html).toContain('chapter-summaries.json');
    expect(html).toContain('exportedAt');
  });
});
