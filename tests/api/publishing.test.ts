import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('publishing routes', () => {
  afterEach(async () => {
    await buildApp().close();
  });

  it('accepts publish profile updates', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/projects/project-1/publish-profile',
      payload: {
        publishEnabled: true,
        autoPublishTargets: ['alpha'],
        manualExportTargets: ['beta'],
        defaultExportFormat: 'markdown',
        effectiveFromChapter: 2
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projectId: 'project-1',
      publishEnabled: true,
      autoPublishTargets: ['alpha'],
      manualExportTargets: ['beta'],
      defaultExportFormat: 'markdown',
      effectiveFromChapter: 2
    });
  });
});
