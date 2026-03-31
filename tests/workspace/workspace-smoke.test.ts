import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('workspace smoke', () => {
  it('loads root package metadata and workspace config', async () => {
    const { default: pkg } = await import('../../package.json');
    const workspace = await readFile(new URL('../../pnpm-workspace.yaml', import.meta.url), 'utf8');
    const { default: turbo } = await import('../../turbo.json');

    expect(pkg.name).toBe('novel-creator');
    expect(pkg.private).toBe(true);
    expect(pkg.packageManager).toBe('pnpm@10.0.0');
    expect(pkg.scripts).toMatchObject({
      build: 'turbo run build',
      dev: 'turbo run dev --parallel',
      lint: 'turbo run lint',
      test: 'vitest run',
    });
    expect(workspace).toContain('apps/*');
    expect(workspace).toContain('packages/*');
    expect(workspace).toContain('tests');
    expect(turbo.tasks).toMatchObject({
      build: expect.objectContaining({
        dependsOn: ['^build'],
        outputs: ['dist/**', '.next/**'],
      }),
      dev: expect.objectContaining({
        cache: false,
        persistent: true,
      }),
      lint: {},
      test: {},
    });
  });
});
