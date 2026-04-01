import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import storagePackage from '../../packages/storage/package.json';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..');

function importFreshModule(relativePath: string) {
  return import(`${pathToFileURL(resolve(repoRoot, relativePath)).href}?t=${Date.now()}`);
}

describe('storage package setup', () => {
  it('declares the Prisma generation contract needed by the package', () => {
    expect(storagePackage.dependencies?.['@prisma/client']).toBeDefined();
    expect(storagePackage.devDependencies?.prisma).toBeDefined();
    expect(storagePackage.prisma?.schema).toBe('./prisma/schema.prisma');
    expect(storagePackage.scripts?.['prisma:generate']).toBe('prisma generate');
    expect(storagePackage.scripts?.postinstall).toBe('prisma generate');
  });

  it('generates a Prisma client and imports the real storage scaffold', async () => {
    execFileSync('node', ['tests/storage/verify-storage-prisma-client.mjs'], {
      cwd: repoRoot,
      stdio: 'pipe'
    });

    const { createPrismaClient, prisma } = await importFreshModule('packages/storage/src/client.ts');
    expect(typeof createPrismaClient).toBe('function');
    expect(prisma.novelProject).toBeDefined();
    expect(prisma.promptConfig).toBeDefined();

    const { ProjectRepository } = await importFreshModule(
      'packages/storage/src/repositories/project-repository.ts'
    );
    const { PromptRepository } = await importFreshModule(
      'packages/storage/src/repositories/prompt-repository.ts'
    );

    expect(new ProjectRepository()).toBeInstanceOf(ProjectRepository);
    expect(new PromptRepository()).toBeInstanceOf(PromptRepository);

    await prisma.$disconnect();
  });
});
