import { describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('projects route', () => {
  it('creates a project', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: '寒江伏魔录',
        genre: '仙侠',
        premise: '小城捕快卷入仙门秘案',
        targetChapterCount: 180,
        chaptersPerDay: 2
      }
    });

    expect(response.statusCode).toBe(201);
  });
});
