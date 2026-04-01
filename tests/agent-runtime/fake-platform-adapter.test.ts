import { describe, expect, it } from 'vitest';
import { fakePlatformAdapter } from '../../packages/agent-runtime/src/fake-platform-adapter';

describe('fakePlatformAdapter', () => {
  it('publishes a chapter payload successfully', async () => {
    const result = await fakePlatformAdapter.publishChapter({
      targetPlatform: 'alpha',
      chapterNumber: 4,
      payload: { title: 'Chapter 4', content: 'Body' }
    });

    expect(result.status).toBe('published');
    expect(result.remoteId).toContain('alpha');
  });

  it('validates config and reports publish status', async () => {
    expect(fakePlatformAdapter.validateConfig({ targetPlatform: 'alpha' })).toBe(true);
    expect(fakePlatformAdapter.validateConfig({ targetPlatform: '' })).toBe(false);

    await expect(
      fakePlatformAdapter.getPublishStatus({ remoteId: 'alpha-chapter-4' })
    ).resolves.toEqual({
      remoteId: 'alpha-chapter-4',
      status: 'published'
    });
  });
});
