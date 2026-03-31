import { describe, expect, it } from 'vitest';

describe('workspace smoke', () => {
  it('loads root package metadata', async () => {
    const pkg = await import('../../package.json');
    expect(pkg.name).toBe('novel-creator');
  });
});
