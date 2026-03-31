# AI Novel Generator Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working slice of the AI novel generator: monorepo scaffold, core domain schema, LLM capacity scheduler, `superpower` workflow skeleton, agent prompt management, and a minimal internal control panel.

**Architecture:** Use a TypeScript monorepo with `apps/web`, `apps/api`, and `apps/worker`, backed by PostgreSQL and Redis. Keep story state, workflow state, and provider-capacity state separate, and route every model call through a shared `llm-gateway` package before any workflow code can invoke a provider.

**Tech Stack:** `pnpm`, `turbo`, `Next.js`, `Fastify`, `BullMQ`, `PostgreSQL`, `Prisma`, `Redis`, `Vitest`, `superpower`

---

## Scope Split

This spec is too large for a single execution plan. Split implementation into four plans:

1. Phase 1: foundation, schema, LLM scheduler, workflow skeleton, prompt registry, minimal console
2. Phase 2: novel generation flows, agent execution, review/rewrite loop
3. Phase 3: decision session UI, platform publishing, workflow observability
4. Phase 4: operational hardening, cost controls, regression suites, provider fallback drills

This document covers only Phase 1. It should produce a working repository skeleton with one vertical slice: create a novel project, store story state, register prompts, reserve provider capacity, and enqueue a placeholder workflow run.

## File Structure

### New files and responsibilities

- `package.json`
  - workspace root scripts and package manager metadata
- `pnpm-workspace.yaml`
  - workspace package selection
- `turbo.json`
  - task pipeline
- `tsconfig.base.json`
  - shared TypeScript config
- `apps/web/package.json`
  - Next.js app dependencies
- `apps/web/src/app/layout.tsx`
  - app shell
- `apps/web/src/app/page.tsx`
  - dashboard landing page
- `apps/web/src/app/projects/page.tsx`
  - novel project list page
- `apps/web/src/app/prompts/page.tsx`
  - prompt configuration list page
- `apps/web/src/lib/api.ts`
  - server-side API client helpers
- `apps/api/package.json`
  - Fastify app dependencies
- `apps/api/src/server.ts`
  - API bootstrap
- `apps/api/src/app.ts`
  - Fastify app factory
- `apps/api/src/routes/projects.ts`
  - project routes
- `apps/api/src/routes/prompts.ts`
  - prompt routes
- `apps/api/src/routes/provider-capacity.ts`
  - provider/key management routes
- `apps/worker/package.json`
  - worker dependencies
- `apps/worker/src/worker.ts`
  - BullMQ worker bootstrap
- `apps/worker/src/jobs/workflow-job.ts`
  - workflow job runner
- `packages/domain/package.json`
  - shared types package metadata
- `packages/domain/src/novel-project.ts`
  - project and story state types
- `packages/domain/src/provider-capacity.ts`
  - provider/model/key capacity types
- `packages/domain/src/prompt-config.ts`
  - prompt config types
- `packages/domain/src/index.ts`
  - package exports
- `packages/storage/package.json`
  - Prisma storage package metadata
- `packages/storage/prisma/schema.prisma`
  - database schema
- `packages/storage/src/client.ts`
  - Prisma client wrapper
- `packages/storage/src/repositories/project-repository.ts`
  - project persistence
- `packages/storage/src/repositories/prompt-repository.ts`
  - prompt persistence
- `packages/llm-gateway/package.json`
  - gateway package metadata
- `packages/llm-gateway/src/capacity-service.ts`
  - lease acquisition and release
- `packages/llm-gateway/src/provider-registry.ts`
  - provider/model/key registry and selection
- `packages/llm-gateway/src/index.ts`
  - package exports
- `packages/workflows/package.json`
  - workflow package metadata
- `packages/workflows/src/create-project-flow.ts`
  - initial project flow definition
- `packages/workflows/src/generate-outline-flow.ts`
  - outline flow placeholder
- `packages/workflows/src/enqueue.ts`
  - queue helper for flow dispatch
- `packages/workflows/src/index.ts`
  - package exports
- `packages/agent-runtime/package.json`
  - runtime package metadata
- `packages/agent-runtime/src/context-assembler.ts`
  - agent-specific context assembly
- `packages/agent-runtime/src/prompt-renderer.ts`
  - prompt template rendering
- `packages/agent-runtime/src/index.ts`
  - package exports
- `tests/api/projects.test.ts`
  - API tests for project lifecycle
- `tests/api/prompts.test.ts`
  - API tests for prompt config lifecycle
- `tests/llm-gateway/capacity-service.test.ts`
  - lease selection and release tests
- `tests/workflows/create-project-flow.test.ts`
  - flow enqueue tests
- `.env.example`
  - local environment variables
- `README.md`
  - setup and runbook

## Task 1: Scaffold The Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `apps/web/package.json`
- Create: `apps/api/package.json`
- Create: `apps/worker/package.json`
- Create: `packages/domain/package.json`
- Create: `packages/storage/package.json`
- Create: `packages/llm-gateway/package.json`
- Create: `packages/workflows/package.json`
- Create: `packages/agent-runtime/package.json`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Write the failing workspace smoke test**

```ts
// tests/workspace/workspace-smoke.test.ts
import { describe, expect, it } from 'vitest';

describe('workspace smoke', () => {
  it('loads root package metadata', async () => {
    const pkg = await import('../../package.json');
    expect(pkg.name).toBe('novel-creator');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/workspace/workspace-smoke.test.ts`
Expected: FAIL with `Cannot find module '../../package.json'` or `pnpm: command not found` before setup.

- [ ] **Step 3: Write minimal workspace files**

```json
// package.json
{
  "name": "novel-creator",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "test": "vitest run"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
  - tests
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {}
  }
}
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": "."
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/workspace/workspace-smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .env.example README.md apps packages tests
git commit -m "chore: scaffold monorepo workspace"
```

## Task 2: Define Domain Types And Database Schema

**Files:**
- Create: `packages/domain/src/novel-project.ts`
- Create: `packages/domain/src/provider-capacity.ts`
- Create: `packages/domain/src/prompt-config.ts`
- Create: `packages/domain/src/index.ts`
- Create: `packages/storage/prisma/schema.prisma`
- Create: `packages/storage/src/client.ts`
- Create: `packages/storage/src/repositories/project-repository.ts`
- Create: `packages/storage/src/repositories/prompt-repository.ts`
- Test: `tests/storage/project-repository.test.ts`

- [ ] **Step 1: Write the failing repository test**

```ts
// tests/storage/project-repository.test.ts
import { describe, expect, it } from 'vitest';
import { createNovelProject } from '../../packages/domain/src/novel-project';

describe('project repository contracts', () => {
  it('creates a new draft project payload', () => {
    const project = createNovelProject({
      title: '北境长夜',
      genre: '玄幻',
      premise: '边境少年卷入王朝与异族战争',
      targetChapterCount: 240,
      chaptersPerDay: 3
    });

    expect(project.status).toBe('draft');
    expect(project.targetChapterCount).toBe(240);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/storage/project-repository.test.ts`
Expected: FAIL with `Cannot find module '../../packages/domain/src/novel-project'`

- [ ] **Step 3: Write minimal domain model and schema**

```ts
// packages/domain/src/novel-project.ts
export type NovelProjectStatus = 'draft' | 'active' | 'blocked' | 'paused' | 'completed';

export interface CreateNovelProjectInput {
  title: string;
  genre: string;
  premise: string;
  targetChapterCount: number;
  chaptersPerDay: number;
}

export interface NovelProject {
  id: string;
  title: string;
  genre: string;
  premise: string;
  targetChapterCount: number;
  chaptersPerDay: number;
  status: NovelProjectStatus;
}

export function createNovelProject(input: CreateNovelProjectInput): NovelProject {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    genre: input.genre,
    premise: input.premise,
    targetChapterCount: input.targetChapterCount,
    chaptersPerDay: input.chaptersPerDay,
    status: 'draft'
  };
}
```

```prisma
// packages/storage/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model NovelProject {
  id                 String   @id @default(uuid())
  title              String
  genre              String
  premise            String
  targetChapterCount Int
  chaptersPerDay     Int
  status             String
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}

model PromptConfig {
  id              String   @id @default(uuid())
  agentName       String
  version         Int
  systemPrompt    String
  taskTemplate    String
  outputSchema    Json
  reviewRubric    String?
  enabled         Boolean  @default(true)
  lastTestedModel String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ProviderKey {
  id                    String   @id @default(uuid())
  provider              String
  model                 String
  keyName               String
  secretRef             String
  maxConcurrentRequests Int
  requestsPerMinute     Int
  tokensPerMinute       Int
  dailyBudget           Decimal  @db.Decimal(10, 2)
  enabled               Boolean  @default(true)
  priority              Int      @default(0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/storage/project-repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain packages/storage tests/storage/project-repository.test.ts
git commit -m "feat: add core domain types and schema"
```

## Task 3: Build The LLM Capacity Scheduler

**Files:**
- Create: `packages/llm-gateway/src/provider-registry.ts`
- Create: `packages/llm-gateway/src/capacity-service.ts`
- Create: `packages/llm-gateway/src/index.ts`
- Test: `tests/llm-gateway/capacity-service.test.ts`

- [ ] **Step 1: Write the failing capacity test**

```ts
// tests/llm-gateway/capacity-service.test.ts
import { describe, expect, it } from 'vitest';
import { CapacityService } from '../../packages/llm-gateway/src/capacity-service';

describe('CapacityService', () => {
  it('leases the highest-priority available key', async () => {
    const service = new CapacityService([
      {
        id: 'key-a',
        provider: 'openai',
        model: 'gpt-5-mini',
        priority: 10,
        enabled: true,
        maxConcurrentRequests: 2,
        currentLeases: 0
      },
      {
        id: 'key-b',
        provider: 'openai',
        model: 'gpt-5-mini',
        priority: 1,
        enabled: true,
        maxConcurrentRequests: 2,
        currentLeases: 0
      }
    ]);

    const lease = await service.acquire({
      provider: 'openai',
      model: 'gpt-5-mini'
    });

    expect(lease.keyId).toBe('key-a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/llm-gateway/capacity-service.test.ts`
Expected: FAIL with `Cannot find module '../../packages/llm-gateway/src/capacity-service'`

- [ ] **Step 3: Write minimal scheduler implementation**

```ts
// packages/llm-gateway/src/capacity-service.ts
export interface CapacityKey {
  id: string;
  provider: string;
  model: string;
  priority: number;
  enabled: boolean;
  maxConcurrentRequests: number;
  currentLeases: number;
}

export interface AcquireRequest {
  provider: string;
  model: string;
}

export class CapacityService {
  constructor(private readonly keys: CapacityKey[]) {}

  async acquire(request: AcquireRequest): Promise<{ keyId: string }> {
    const candidate = this.keys
      .filter((key) => key.enabled)
      .filter((key) => key.provider === request.provider && key.model === request.model)
      .filter((key) => key.currentLeases < key.maxConcurrentRequests)
      .sort((left, right) => right.priority - left.priority)[0];

    if (!candidate) {
      throw new Error(`No capacity for ${request.provider}/${request.model}`);
    }

    candidate.currentLeases += 1;
    return { keyId: candidate.id };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/llm-gateway/capacity-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/llm-gateway tests/llm-gateway/capacity-service.test.ts
git commit -m "feat: add provider capacity lease service"
```

## Task 4: Add Prompt Registry And Context Assembly

**Files:**
- Create: `packages/agent-runtime/src/context-assembler.ts`
- Create: `packages/agent-runtime/src/prompt-renderer.ts`
- Create: `packages/agent-runtime/src/index.ts`
- Test: `tests/agent-runtime/context-assembler.test.ts`

- [ ] **Step 1: Write the failing context test**

```ts
// tests/agent-runtime/context-assembler.test.ts
import { describe, expect, it } from 'vitest';
import { assembleChapterDraftContext } from '../../packages/agent-runtime/src/context-assembler';

describe('context assembler', () => {
  it('omits full historical chapters from chapter drafting context', () => {
    const context = assembleChapterDraftContext({
      chapterPlan: '本章计划',
      recentSummaries: ['第十章摘要', '第十一章摘要'],
      fullTextHistory: ['第一章全文', '第二章全文']
    });

    expect(context).toContain('本章计划');
    expect(context).not.toContain('第一章全文');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/agent-runtime/context-assembler.test.ts`
Expected: FAIL with `Cannot find module '../../packages/agent-runtime/src/context-assembler'`

- [ ] **Step 3: Write minimal context assembly**

```ts
// packages/agent-runtime/src/context-assembler.ts
interface ChapterDraftContextInput {
  chapterPlan: string;
  recentSummaries: string[];
  fullTextHistory: string[];
}

export function assembleChapterDraftContext(input: ChapterDraftContextInput): string {
  return [
    '## Current Chapter Plan',
    input.chapterPlan,
    '## Recent Summaries',
    ...input.recentSummaries
  ].join('\n');
}
```

```ts
// packages/agent-runtime/src/prompt-renderer.ts
export function renderPrompt(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, value);
  }, template);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/agent-runtime/context-assembler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/agent-runtime tests/agent-runtime/context-assembler.test.ts
git commit -m "feat: add agent context assembly and prompt rendering"
```

## Task 5: Create The API For Projects, Prompts, And Capacity

**Files:**
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/projects.ts`
- Create: `apps/api/src/routes/prompts.ts`
- Create: `apps/api/src/routes/provider-capacity.ts`
- Test: `tests/api/projects.test.ts`
- Test: `tests/api/prompts.test.ts`

- [ ] **Step 1: Write the failing API test**

```ts
// tests/api/projects.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/api/projects.test.ts`
Expected: FAIL with `Cannot find module '../../apps/api/src/app'`

- [ ] **Step 3: Write minimal Fastify routes**

```ts
// apps/api/src/app.ts
import Fastify from 'fastify';
import { registerProjectRoutes } from './routes/projects';
import { registerPromptRoutes } from './routes/prompts';
import { registerProviderCapacityRoutes } from './routes/provider-capacity';

export function buildApp() {
  const app = Fastify();
  registerProjectRoutes(app);
  registerPromptRoutes(app);
  registerProviderCapacityRoutes(app);
  return app;
}
```

```ts
// apps/api/src/routes/projects.ts
import { FastifyInstance } from 'fastify';
import { createNovelProject } from '../../../../packages/domain/src/novel-project';

export function registerProjectRoutes(app: FastifyInstance) {
  app.post('/projects', async (request, reply) => {
    const project = createNovelProject(request.body as any);
    return reply.code(201).send(project);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/api/projects.test.ts tests/api/prompts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api tests/api/projects.test.ts tests/api/prompts.test.ts
git commit -m "feat: add api routes for projects prompts and capacity"
```

## Task 6: Add The Workflow Skeleton And Worker

**Files:**
- Create: `packages/workflows/src/create-project-flow.ts`
- Create: `packages/workflows/src/generate-outline-flow.ts`
- Create: `packages/workflows/src/enqueue.ts`
- Create: `packages/workflows/src/index.ts`
- Create: `apps/worker/src/jobs/workflow-job.ts`
- Create: `apps/worker/src/worker.ts`
- Test: `tests/workflows/create-project-flow.test.ts`

- [ ] **Step 1: Write the failing workflow test**

```ts
// tests/workflows/create-project-flow.test.ts
import { describe, expect, it } from 'vitest';
import { createProjectFlow } from '../../packages/workflows/src/create-project-flow';

describe('createProjectFlow', () => {
  it('returns the initial workflow step list', () => {
    const flow = createProjectFlow();
    expect(flow.steps).toEqual([
      'persist-project',
      'enqueue-outline',
      'mark-project-active'
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/workflows/create-project-flow.test.ts`
Expected: FAIL with `Cannot find module '../../packages/workflows/src/create-project-flow'`

- [ ] **Step 3: Write minimal workflow skeleton**

```ts
// packages/workflows/src/create-project-flow.ts
export function createProjectFlow() {
  return {
    name: 'create-project-flow',
    steps: ['persist-project', 'enqueue-outline', 'mark-project-active']
  };
}
```

```ts
// apps/worker/src/jobs/workflow-job.ts
export async function runWorkflowJob(jobName: string) {
  return { jobName, status: 'queued' as const };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/workflows/create-project-flow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/workflows apps/worker tests/workflows/create-project-flow.test.ts
git commit -m "feat: add workflow skeleton and worker entrypoint"
```

## Task 7: Build The Minimal Internal Console

**Files:**
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/projects/page.tsx`
- Create: `apps/web/src/app/prompts/page.tsx`
- Create: `apps/web/src/lib/api.ts`
- Test: `tests/web/dashboard.test.tsx`

- [ ] **Step 1: Write the failing dashboard test**

```tsx
// tests/web/dashboard.test.tsx
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import HomePage from '../../apps/web/src/app/page';

describe('dashboard page', () => {
  it('renders the control panel heading', () => {
    const html = renderToString(<HomePage />);
    expect(html).toContain('AI Novel Control Panel');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/web/dashboard.test.tsx`
Expected: FAIL with `Cannot find module '../../apps/web/src/app/page'`

- [ ] **Step 3: Write minimal Next.js pages**

```tsx
// apps/web/src/app/page.tsx
export default function HomePage() {
  return (
    <main>
      <h1>AI Novel Control Panel</h1>
      <p>Manage projects, prompts, provider capacity, and queued workflows.</p>
    </main>
  );
}
```

```tsx
// apps/web/src/app/projects/page.tsx
export default function ProjectsPage() {
  return <main><h1>Projects</h1></main>;
}
```

```tsx
// apps/web/src/app/prompts/page.tsx
export default function PromptsPage() {
  return <main><h1>Agent Prompts</h1></main>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/web/dashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web tests/web/dashboard.test.tsx
git commit -m "feat: add minimal internal control panel pages"
```

## Task 8: Add Local Runbook And Phase Exit Checks

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Test: `tests/e2e/phase-1-smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
// tests/e2e/phase-1-smoke.test.ts
import { describe, expect, it } from 'vitest';
import { createProjectFlow } from '../../packages/workflows/src/create-project-flow';

describe('phase 1 smoke', () => {
  it('exposes the baseline create-project flow', () => {
    expect(createProjectFlow().name).toBe('create-project-flow');
  });
});
```

- [ ] **Step 2: Run test to verify it fails when phase artifacts are missing**

Run: `pnpm vitest tests/e2e/phase-1-smoke.test.ts`
Expected: FAIL until workflow package is present and exported.

- [ ] **Step 3: Write setup docs and env template**

```env
# .env.example
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/novel_creator
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

```md
# README.md

## Setup

1. `pnpm install`
2. `docker compose up -d postgres redis`
3. `pnpm --filter @novel-creator/storage prisma migrate dev`
4. `pnpm dev`

## Phase 1 Expected Behavior

- `POST /projects` creates a project payload
- prompt configs can be listed and updated
- capacity service can lease a provider key
- worker can enqueue a placeholder workflow job
- web dashboard renders the internal control panel shell
```

- [ ] **Step 4: Run the full phase test suite**

Run: `pnpm vitest run tests/workspace tests/storage tests/llm-gateway tests/agent-runtime tests/api tests/workflows tests/web tests/e2e`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example tests/e2e/phase-1-smoke.test.ts
git commit -m "docs: add phase 1 setup and smoke checks"
```

## Spec Coverage Check

- Project creation and story state foundation: covered by Tasks 2, 5, and 6
- Provider/model/key concurrency control foundation: covered by Task 3
- Agent-specific prompt and context handling: covered by Task 4
- Internal control panel without auth: covered by Task 7
- Minimal workflow entrypoint with `superpower`-aligned structure: covered by Task 6

Deferred to later plans:

- actual outline generation
- chapter planning and drafting
- automated review/rewrite loops
- decision session chat UI
- platform publishing connectors
- workflow observability dashboards

## Placeholder Scan

This plan intentionally leaves no `TBD` or `TODO` markers. Phase 2+ work is explicitly deferred rather than implied.

## Type Consistency Check

- `NovelProject` is the root project record used by API, storage, and workflow tasks
- `CapacityService` is the only lease entrypoint for provider/model/key selection in Phase 1
- `createProjectFlow()` is the baseline workflow contract and is reused in worker and smoke tests
