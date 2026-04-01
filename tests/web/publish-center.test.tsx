import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import PublishCenterPage from '../../apps/web/src/app/publish/page';

describe('PublishCenterPage', () => {
  it('renders publish tasks and export artifacts', async () => {
    const Page = await PublishCenterPage();
    const html = renderToString(Page);

    expect(html).toContain('Publish Center');
    expect(html).toContain('alpha');
    expect(html).toContain('beta');
  });
});
