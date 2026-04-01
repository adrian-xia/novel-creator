import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import HomePage from '../../apps/web/src/app/page';

describe('dashboard page', () => {
  it('renders the control panel heading', () => {
    const html = renderToString(<HomePage />);
    expect(html).toContain('AI Novel Control Panel');
  });
});
