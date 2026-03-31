import { describe, expect, it } from 'vitest';
import storagePackage from '../../packages/storage/package.json';

describe('storage package setup', () => {
  it('declares the Prisma generation contract needed by the package', () => {
    expect(storagePackage.dependencies?.['@prisma/client']).toBeDefined();
    expect(storagePackage.devDependencies?.prisma).toBeDefined();
    expect(storagePackage.prisma?.schema).toBe('./prisma/schema.prisma');
    expect(storagePackage.scripts?.['prisma:generate']).toBe('prisma generate');
    expect(storagePackage.scripts?.postinstall).toBe('prisma generate');
  });
});
