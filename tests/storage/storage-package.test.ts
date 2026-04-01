import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
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

  it('declares unique draft versions in the Prisma schema', () => {
    const schema = readFileSync(resolve(repoRoot, 'packages/storage/prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('@@unique([projectId, chapterNumber, version])');
  });

  it('declares project foreign-key relations for task 2 storage records', () => {
    const schema = readFileSync(resolve(repoRoot, 'packages/storage/prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('storyState');
    expect(schema).toContain('StoryState?');
    expect(schema).toContain('outlineRecords');
    expect(schema).toContain('OutlineRecord[]');
    expect(schema).toContain('volumePlanRecords');
    expect(schema).toContain('VolumePlanRecord[]');
    expect(schema).toContain('chapterPlanRecords');
    expect(schema).toContain('ChapterPlanRecord[]');
    expect(schema).toContain('chapterDraftRecords');
    expect(schema).toContain('ChapterDraftRecord[]');
    expect(schema).toContain('chapterStateRecords');
    expect(schema).toContain('ChapterStateRecord[]');
    expect(schema).toContain('reviewOutcomeRecords');
    expect(schema).toContain('ReviewOutcomeRecord[]');
    expect(schema).toContain('agentRunRecords');
    expect(schema).toContain('AgentRunRecord[]');
    expect(schema).toContain('project');
    expect(schema).toContain('NovelProject @relation(fields: [projectId], references: [id])');
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
    expect(prisma.chapterStateRecord).toBeDefined();
    expect(prisma.chapterDraftRecord).toBeDefined();

    const { ProjectRepository } = await importFreshModule(
      'packages/storage/src/repositories/project-repository.ts'
    );
    const { PromptRepository } = await importFreshModule(
      'packages/storage/src/repositories/prompt-repository.ts'
    );
    const { StoryStateRepository } = await importFreshModule(
      'packages/storage/src/repositories/story-state-repository.ts'
    );

    expect(new ProjectRepository()).toBeInstanceOf(ProjectRepository);
    expect(new PromptRepository()).toBeInstanceOf(PromptRepository);
    expect(new StoryStateRepository()).toBeInstanceOf(StoryStateRepository);

    await prisma.$disconnect();
  }, 45_000);
});
