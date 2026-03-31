import { execFileSync } from 'node:child_process';
import { realpathSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..');
const storageDir = resolve(repoRoot, 'packages/storage');
const prismaClientPackageDir = realpathSync(resolve(storageDir, 'node_modules/@prisma/client'));
const generatedClientDir = resolve(prismaClientPackageDir, '..', '..', '.prisma');

rmSync(generatedClientDir, { force: true, recursive: true });

execFileSync('corepack', ['pnpm', '--dir', storageDir, 'prisma:generate'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/novel_creator'
  },
  stdio: 'pipe'
});
