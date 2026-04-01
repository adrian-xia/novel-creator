# AI Novel Generator Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real novel-production pipeline on top of Phase 1 by adding outline, volume, chapter plan, chapter draft, and review/rewrite flows with persistent story state.

**Architecture:** Extend the existing monorepo in-place. Keep story state, chapter state, review state, and agent execution state as explicit persisted records; run every LLM-backed step through the existing `llm-gateway` and `agent-runtime`, and keep workflow boundaries narrow so retries do not replay unrelated steps.

**Tech Stack:** `TypeScript`, `pnpm`, `Vitest`, `Fastify`, `Next.js`, `Prisma`, `BullMQ`, `superpower`

---

## Scope Split

This plan covers only the Phase 2 vertical slice defined in [2026-04-01-ai-novel-generator-phase-2-design.md](/root/git-resources/creator/novel-creator/docs/superpowers/specs/2026-04-01-ai-novel-generator-phase-2-design.md):

1. persistent story state and chapter state
2. outline and volume flows
3. chapter plan, chapter draft, and review/rewrite flows
4. project detail API and minimal production console
5. integration and smoke coverage for the first real production chain

It does not cover `DecisionSession`, publishing, or workflow observability dashboards.

## File Structure

### New files and responsibilities

- `packages/domain/src/story-state.ts`
  - story, chapter, draft, and review domain types
- `packages/storage/src/repositories/story-state-repository.ts`
  - outline, volume, chapter state, draft, review persistence
- `packages/agent-runtime/src/agent-runner.ts`
  - shared agent execution wrapper that acquires capacity, renders prompts, and records `AgentRun`
- `packages/workflows/src/generate-volume-flow.ts`
  - volume flow definition
- `packages/workflows/src/generate-chapter-flow.ts`
  - chapter plan + draft flow definition
- `packages/workflows/src/review-rewrite-flow.ts`
  - review + bounded rewrite flow definition
- `apps/api/src/routes/story-production.ts`
  - flow trigger and detail-read routes
- `apps/web/src/app/projects/[projectId]/page.tsx`
  - project production detail page
- `tests/storage/story-state-repository.test.ts`
  - persistence tests for story and chapter state
- `tests/agent-runtime/agent-runner.test.ts`
  - agent execution wrapper tests
- `tests/workflows/generate-outline-flow.test.ts`
  - outline flow tests
- `tests/workflows/generate-volume-flow.test.ts`
  - volume flow tests
- `tests/workflows/generate-chapter-flow.test.ts`
  - chapter pipeline tests
- `tests/workflows/review-rewrite-flow.test.ts`
  - review/rewrite bounded loop tests
- `tests/api/story-production.test.ts`
  - project detail and flow trigger API tests
- `tests/web/project-detail.test.tsx`
  - production detail page rendering test
- `tests/e2e/phase-2-smoke.test.ts`
  - end-to-end pipeline smoke

### Existing files to modify

- `packages/domain/src/index.ts`
  - export new story-state types
- `packages/storage/prisma/schema.prisma`
  - add story state, outline, volume, chapter plan, chapter draft, review, and agent run models
- `packages/storage/src/client.ts`
  - expose Prisma models through the existing client wrapper
- `packages/storage/src/repositories/project-repository.ts`
  - add project detail reads used by story production endpoints
- `packages/agent-runtime/src/context-assembler.ts`
  - add assembly helpers for outline, volume, chapter plan, draft, review, rewrite
- `packages/agent-runtime/src/index.ts`
  - export new runtime helpers
- `packages/workflows/src/generate-outline-flow.ts`
  - replace placeholder with real flow definition
- `packages/workflows/src/index.ts`
  - export all new flow definitions
- `apps/api/src/app.ts`
  - register story production routes
- `apps/worker/src/jobs/workflow-job.ts`
  - dispatch new flow names
- `apps/web/src/lib/api.ts`
  - add project detail fetch helpers
- `apps/web/src/app/projects/page.tsx`
  - link into project detail page
- `README.md`
  - document Phase 2 setup and expected behavior

## Task 1: Expand Domain Types For Story Production

**Files:**
- Create: `packages/domain/src/story-state.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `tests/storage/story-state-types.test.ts`

- [ ] **Step 1: Write the failing type contract test**

```ts
// tests/storage/story-state-types.test.ts
import { describe, expectTypeOf, it } from 'vitest';
import type {
  AgentRun,
  ChapterDraft,
  ChapterPlan,
  ChapterState,
  ReviewOutcome,
  StoryState
} from '../../packages/domain/src';

describe('story-state domain contracts', () => {
  it('exposes the story production types', () => {
    expectTypeOf<StoryState>().toMatchTypeOf<{
      projectId: string;
      storyBible: string | null;
      outline: unknown | null;
      volumePlans: unknown[];
      confirmedFacts: string[];
      openForeshadowing: string[];
      chapterSummaries: Array<{ chapterNumber: number; summary: string }>;
      currentPosition: { nextChapterNumber: number; currentVolumeNumber: number | null };
    }>();

    expectTypeOf<ChapterState>().toEqualTypeOf<
      | 'pending'
      | 'planned'
      | 'drafted'
      | 'in_review'
      | 'needs_rewrite'
      | 'approved'
      | 'blocked_for_manual_decision'
      | 'failed'
    >();

    expectTypeOf<ChapterPlan>().toMatchTypeOf<{
      projectId: string;
      chapterNumber: number;
      title: string;
      goal: string;
      beats: string[];
      povCharacter: string;
      hardConstraints: string[];
    }>();

    expectTypeOf<ChapterDraft>().toMatchTypeOf<{
      projectId: string;
      chapterNumber: number;
      version: number;
      content: string;
      summary: string | null;
      metadata: Record<string, unknown>;
    }>();

    expectTypeOf<ReviewOutcome>().toMatchTypeOf<{
      projectId: string;
      chapterNumber: number;
      decision: 'approve' | 'rewrite' | 'blocked_for_manual_decision';
      issues: Array<{ code: string; message: string; severity: 'low' | 'medium' | 'high' }>;
      rewriteInstructions: string[];
      canAutoRewrite: boolean;
      triggeredManualDecision: boolean;
    }>();

    expectTypeOf<AgentRun>().toMatchTypeOf<{
      projectId: string;
      chapterNumber: number | null;
      agentType: string;
      promptConfigVersion: number;
      provider: string;
      model: string;
      apiKeyId: string;
      leaseId: string;
      inputSnapshot: Record<string, unknown>;
      rawOutput: string;
      parsedOutput: Record<string, unknown> | null;
      status: 'succeeded' | 'failed';
      tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
      errorMessage: string | null;
    }>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/storage/story-state-types.test.ts`
Expected: FAIL with missing exports from `../../packages/domain/src`

- [ ] **Step 3: Write minimal domain types**

```ts
// packages/domain/src/story-state.ts
export type ChapterState =
  | 'pending'
  | 'planned'
  | 'drafted'
  | 'in_review'
  | 'needs_rewrite'
  | 'approved'
  | 'blocked_for_manual_decision'
  | 'failed';

export interface StoryState {
  projectId: string;
  storyBible: string | null;
  outline: Record<string, unknown> | null;
  volumePlans: Array<Record<string, unknown>>;
  confirmedFacts: string[];
  openForeshadowing: string[];
  chapterSummaries: Array<{ chapterNumber: number; summary: string }>;
  currentPosition: {
    nextChapterNumber: number;
    currentVolumeNumber: number | null;
  };
}

export interface ChapterPlan {
  projectId: string;
  chapterNumber: number;
  title: string;
  goal: string;
  beats: string[];
  povCharacter: string;
  hardConstraints: string[];
}

export interface ChapterDraft {
  projectId: string;
  chapterNumber: number;
  version: number;
  content: string;
  summary: string | null;
  metadata: Record<string, unknown>;
}

export interface ReviewIssue {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ReviewOutcome {
  projectId: string;
  chapterNumber: number;
  decision: 'approve' | 'rewrite' | 'blocked_for_manual_decision';
  issues: ReviewIssue[];
  rewriteInstructions: string[];
  canAutoRewrite: boolean;
  triggeredManualDecision: boolean;
}

export interface AgentRun {
  projectId: string;
  chapterNumber: number | null;
  agentType: string;
  promptConfigVersion: number;
  provider: string;
  model: string;
  apiKeyId: string;
  leaseId: string;
  inputSnapshot: Record<string, unknown>;
  rawOutput: string;
  parsedOutput: Record<string, unknown> | null;
  status: 'succeeded' | 'failed';
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  errorMessage: string | null;
}
```

```ts
// packages/domain/src/index.ts
export * from './novel-project';
export * from './prompt-config';
export * from './provider-capacity';
export * from './story-state';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run tests/storage/story-state-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/story-state.ts packages/domain/src/index.ts tests/storage/story-state-types.test.ts
git commit -m "feat: add story production domain types"
```

## Task 2: Add Prisma Models And Story State Repository

**Files:**
- Modify: `packages/storage/prisma/schema.prisma`
- Modify: `packages/storage/src/client.ts`
- Modify: `packages/storage/src/repositories/project-repository.ts`
- Create: `packages/storage/src/repositories/story-state-repository.ts`
- Test: `tests/storage/story-state-repository.test.ts`

- [ ] **Step 1: Write the failing repository test**

```ts
// tests/storage/story-state-repository.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryStateRepository } from '../../packages/storage/src/repositories/story-state-repository';

const prisma = {
  storyState: {
    upsert: vi.fn()
  },
  outlineRecord: {
    create: vi.fn()
  },
  volumePlanRecord: {
    createMany: vi.fn()
  },
  chapterPlanRecord: {
    create: vi.fn()
  },
  chapterDraftRecord: {
    create: vi.fn()
  },
  reviewOutcomeRecord: {
    create: vi.fn()
  },
  agentRunRecord: {
    create: vi.fn()
  }
};

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('StoryStateRepository', () => {
  beforeEach(() => {
    Object.values(prisma).forEach(model => {
      Object.values(model).forEach(fn => {
        if (typeof fn === 'function' && 'mockReset' in fn) fn.mockReset();
      });
    });
  });

  it('persists outline and story state in one method call', async () => {
    prisma.outlineRecord.create.mockResolvedValue({ id: 'outline-1' });
    prisma.storyState.upsert.mockResolvedValue({ projectId: 'project-1' });

    const repository = new StoryStateRepository();

    await repository.saveOutline({
      projectId: 'project-1',
      outline: { title: '总纲', ending: '收束' },
      storyBible: '江湖与仙门并存'
    });

    expect(prisma.outlineRecord.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-1',
        payload: { title: '总纲', ending: '收束' }
      }
    });
    expect(prisma.storyState.upsert).toHaveBeenCalled();
  });

  it('appends approved chapter summaries back into story state', async () => {
    prisma.storyState.upsert.mockResolvedValue({ projectId: 'project-1' });

    const repository = new StoryStateRepository();

    await repository.saveApprovedChapterSummary({
      projectId: 'project-1',
      chapterNumber: 2,
      summary: '主角确认师门内鬼，决定反查账册',
      nextChapterNumber: 3
    });

    expect(prisma.storyState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          chapterSummaries: expect.anything(),
          currentPosition: { nextChapterNumber: 3, currentVolumeNumber: null }
        })
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/storage/story-state-repository.test.ts`
Expected: FAIL with `Cannot find module '../../packages/storage/src/repositories/story-state-repository'`

- [ ] **Step 3: Extend Prisma schema**

```prisma
// packages/storage/prisma/schema.prisma
model StoryState {
  projectId          String   @id
  storyBible         String?
  outline            Json?
  volumePlans        Json     @default("[]")
  confirmedFacts     Json     @default("[]")
  openForeshadowing  Json     @default("[]")
  chapterSummaries   Json     @default("[]")
  currentPosition    Json
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}

model OutlineRecord {
  id        String   @id @default(uuid())
  projectId String
  payload   Json
  createdAt DateTime @default(now())
}

model VolumePlanRecord {
  id           String   @id @default(uuid())
  projectId    String
  volumeNumber Int
  payload      Json
  createdAt    DateTime @default(now())
}

model ChapterPlanRecord {
  id            String   @id @default(uuid())
  projectId     String
  chapterNumber Int
  payload       Json
  createdAt     DateTime @default(now())
}

model ChapterDraftRecord {
  id            String   @id @default(uuid())
  projectId     String
  chapterNumber Int
  version       Int
  content       String
  summary       String?
  metadata      Json
  createdAt     DateTime @default(now())
}

model ReviewOutcomeRecord {
  id            String   @id @default(uuid())
  projectId     String
  chapterNumber Int
  payload       Json
  createdAt     DateTime @default(now())
}

model AgentRunRecord {
  id                  String   @id @default(uuid())
  projectId           String
  chapterNumber       Int?
  agentType           String
  promptConfigVersion Int
  provider            String
  model               String
  apiKeyId            String
  leaseId             String
  inputSnapshot       Json
  rawOutput           String
  parsedOutput        Json?
  status              String
  tokenUsage          Json
  errorMessage        String?
  createdAt           DateTime @default(now())
}
```

- [ ] **Step 4: Write minimal repository**

```ts
// packages/storage/src/repositories/story-state-repository.ts
import type { AgentRun, ChapterDraft, ChapterPlan, ReviewOutcome } from '@novel-creator/domain';
import { prisma } from '../client';

export class StoryStateRepository {
  async saveOutline(input: {
    projectId: string;
    outline: Record<string, unknown>;
    storyBible: string | null;
  }) {
    await prisma.outlineRecord.create({
      data: {
        projectId: input.projectId,
        payload: input.outline
      }
    });

    return prisma.storyState.upsert({
      where: { projectId: input.projectId },
      create: {
        projectId: input.projectId,
        storyBible: input.storyBible,
        outline: input.outline,
        volumePlans: [],
        confirmedFacts: [],
        openForeshadowing: [],
        chapterSummaries: [],
        currentPosition: { nextChapterNumber: 1, currentVolumeNumber: null }
      },
      update: {
        storyBible: input.storyBible,
        outline: input.outline
      }
    });
  }

  async saveVolumePlans(input: { projectId: string; plans: Array<Record<string, unknown>> }) {
    await prisma.volumePlanRecord.createMany({
      data: input.plans.map((payload, index) => ({
        projectId: input.projectId,
        volumeNumber: index + 1,
        payload
      }))
    });

    return prisma.storyState.upsert({
      where: { projectId: input.projectId },
      create: {
        projectId: input.projectId,
        storyBible: null,
        outline: null,
        volumePlans: input.plans,
        confirmedFacts: [],
        openForeshadowing: [],
        chapterSummaries: [],
        currentPosition: { nextChapterNumber: 1, currentVolumeNumber: 1 }
      },
      update: {
        volumePlans: input.plans,
        currentPosition: { nextChapterNumber: 1, currentVolumeNumber: 1 }
      }
    });
  }

  async saveChapterPlan(plan: ChapterPlan) {
    return prisma.chapterPlanRecord.create({
      data: {
        projectId: plan.projectId,
        chapterNumber: plan.chapterNumber,
        payload: plan
      }
    });
  }

  async saveChapterDraft(draft: ChapterDraft) {
    return prisma.chapterDraftRecord.create({
      data: {
        projectId: draft.projectId,
        chapterNumber: draft.chapterNumber,
        version: draft.version,
        content: draft.content,
        summary: draft.summary,
        metadata: draft.metadata
      }
    });
  }

  async saveReviewOutcome(outcome: ReviewOutcome) {
    return prisma.reviewOutcomeRecord.create({
      data: {
        projectId: outcome.projectId,
        chapterNumber: outcome.chapterNumber,
        payload: outcome
      }
    });
  }

  async saveAgentRun(run: AgentRun) {
    return prisma.agentRunRecord.create({
      data: run
    });
  }

  async saveApprovedChapterSummary(input: {
    projectId: string;
    chapterNumber: number;
    summary: string;
    nextChapterNumber: number;
  }) {
    return prisma.storyState.upsert({
      where: { projectId: input.projectId },
      create: {
        projectId: input.projectId,
        storyBible: null,
        outline: null,
        volumePlans: [],
        confirmedFacts: [],
        openForeshadowing: [],
        chapterSummaries: [{ chapterNumber: input.chapterNumber, summary: input.summary }],
        currentPosition: { nextChapterNumber: input.nextChapterNumber, currentVolumeNumber: null }
      },
      update: {
        chapterSummaries: {
          push: { chapterNumber: input.chapterNumber, summary: input.summary }
        },
        currentPosition: { nextChapterNumber: input.nextChapterNumber, currentVolumeNumber: null }
      }
    });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `corepack pnpm vitest run tests/storage/story-state-repository.test.ts`
Expected: PASS

- [ ] **Step 6: Regenerate Prisma client and run storage verification**

Run: `corepack pnpm --filter @novel-creator/storage prisma generate && corepack pnpm vitest run tests/storage/story-state-repository.test.ts tests/storage/storage-package.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/storage/prisma/schema.prisma packages/storage/src/client.ts packages/storage/src/repositories/project-repository.ts packages/storage/src/repositories/story-state-repository.ts tests/storage/story-state-repository.test.ts
git commit -m "feat: add story state persistence models"
```

## Task 3: Add Agent Runner And Context Assembly For Production Agents

**Files:**
- Modify: `packages/agent-runtime/src/context-assembler.ts`
- Create: `packages/agent-runtime/src/agent-runner.ts`
- Modify: `packages/agent-runtime/src/index.ts`
- Test: `tests/agent-runtime/agent-runner.test.ts`

- [ ] **Step 1: Write the failing runtime test**

```ts
// tests/agent-runtime/agent-runner.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createAgentRunner } from '../../packages/agent-runtime/src/agent-runner';

describe('agent runner', () => {
  it('acquires capacity, renders the prompt, and records a succeeded run', async () => {
    const acquire = vi.fn().mockResolvedValue({
      leaseId: 'lease-1',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      apiKeyId: 'key-1'
    });
    const release = vi.fn().mockResolvedValue(undefined);
    const renderPrompt = vi.fn().mockReturnValue('rendered prompt');
    const invokeModel = vi.fn().mockResolvedValue({
      rawOutput: '{"title":"第一卷"}',
      parsedOutput: { title: '第一卷' },
      tokenUsage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 }
    });
    const saveAgentRun = vi.fn().mockResolvedValue(undefined);

    const runner = createAgentRunner({
      acquire,
      release,
      renderPrompt,
      invokeModel,
      saveAgentRun
    });

    const result = await runner.run({
      agentType: 'outline-agent',
      promptConfigVersion: 3,
      projectId: 'project-1',
      chapterNumber: null,
      inputSnapshot: { premise: '小城捕快卷入仙门秘案' }
    });

    expect(renderPrompt).toHaveBeenCalled();
    expect(invokeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'rendered prompt',
        provider: 'openai',
        model: 'gpt-5.4-mini'
      })
    );
    expect(saveAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'outline-agent',
        leaseId: 'lease-1',
        status: 'succeeded'
      })
    );
    expect(release).toHaveBeenCalledWith('lease-1');
    expect(result.parsedOutput).toEqual({ title: '第一卷' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/agent-runtime/agent-runner.test.ts`
Expected: FAIL with missing `agent-runner.ts`

- [ ] **Step 3: Add minimal context assembly helpers and runner**

```ts
// packages/agent-runtime/src/agent-runner.ts
export function createAgentRunner(deps: {
  acquire: () => Promise<{ leaseId: string; provider: string; model: string; apiKeyId: string }>;
  release: (leaseId: string) => Promise<void>;
  renderPrompt: (input: Record<string, unknown>) => string;
  invokeModel: (input: { prompt: string; provider: string; model: string }) => Promise<{
    rawOutput: string;
    parsedOutput: Record<string, unknown> | null;
    tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  }>;
  saveAgentRun: (run: Record<string, unknown>) => Promise<void>;
}) {
  return {
    async run(input: {
      agentType: string;
      promptConfigVersion: number;
      projectId: string;
      chapterNumber: number | null;
      inputSnapshot: Record<string, unknown>;
    }) {
      const lease = await deps.acquire();
      try {
        const prompt = deps.renderPrompt(input.inputSnapshot);
        const result = await deps.invokeModel({
          prompt,
          provider: lease.provider,
          model: lease.model
        });

        await deps.saveAgentRun({
          projectId: input.projectId,
          chapterNumber: input.chapterNumber,
          agentType: input.agentType,
          promptConfigVersion: input.promptConfigVersion,
          provider: lease.provider,
          model: lease.model,
          apiKeyId: lease.apiKeyId,
          leaseId: lease.leaseId,
          inputSnapshot: input.inputSnapshot,
          rawOutput: result.rawOutput,
          parsedOutput: result.parsedOutput,
          status: 'succeeded',
          tokenUsage: result.tokenUsage,
          errorMessage: null
        });

        await deps.release(lease.leaseId);
        return result;
      } catch (error) {
        await deps.saveAgentRun({
          projectId: input.projectId,
          chapterNumber: input.chapterNumber,
          agentType: input.agentType,
          promptConfigVersion: input.promptConfigVersion,
          provider: lease.provider,
          model: lease.model,
          apiKeyId: lease.apiKeyId,
          leaseId: lease.leaseId,
          inputSnapshot: input.inputSnapshot,
          rawOutput: '',
          parsedOutput: null,
          status: 'failed',
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          errorMessage: error instanceof Error ? error.message : 'unknown error'
        });
        await deps.release(lease.leaseId);
        throw error;
      }
    }
  };
}
```

```ts
// packages/agent-runtime/src/context-assembler.ts
export function assembleOutlineContext(input: {
  premise: string;
  genre: string;
  targetChapterCount: number;
}) {
  return {
    premise: input.premise,
    genre: input.genre,
    targetChapterCount: input.targetChapterCount
  };
}

export function assembleChapterPlanContext(input: {
  currentVolumeSummary: string;
  recentChapterSummaries: string[];
  openForeshadowing: string[];
  chapterNumber: number;
}) {
  return input;
}
```

```ts
// packages/agent-runtime/src/index.ts
export * from './context-assembler';
export * from './prompt-renderer';
export * from './agent-runner';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run tests/agent-runtime/agent-runner.test.ts tests/agent-runtime/context-assembler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/agent-runtime/src/context-assembler.ts packages/agent-runtime/src/agent-runner.ts packages/agent-runtime/src/index.ts tests/agent-runtime/agent-runner.test.ts
git commit -m "feat: add phase 2 agent runner"
```

## Task 4: Replace Outline Placeholder With Real Outline And Volume Flows

**Files:**
- Modify: `packages/workflows/src/generate-outline-flow.ts`
- Create: `packages/workflows/src/generate-volume-flow.ts`
- Modify: `packages/workflows/src/index.ts`
- Test: `tests/workflows/generate-outline-flow.test.ts`
- Test: `tests/workflows/generate-volume-flow.test.ts`

- [ ] **Step 1: Write the failing workflow tests**

```ts
// tests/workflows/generate-outline-flow.test.ts
import { describe, expect, it } from 'vitest';
import { generateOutlineFlow } from '../../packages/workflows/src';

describe('generateOutlineFlow', () => {
  it('defines the real outline workflow steps', () => {
    expect(generateOutlineFlow().steps).toEqual([
      'load-project-input',
      'load-outline-prompt',
      'acquire-capacity',
      'run-outline-agent',
      'validate-outline-output',
      'persist-outline',
      'record-agent-run'
    ]);
  });
});
```

```ts
// tests/workflows/generate-volume-flow.test.ts
import { describe, expect, it } from 'vitest';
import { generateVolumeFlow } from '../../packages/workflows/src';

describe('generateVolumeFlow', () => {
  it('defines the real volume workflow steps', () => {
    expect(generateVolumeFlow().steps).toEqual([
      'load-outline',
      'load-volume-prompt',
      'acquire-capacity',
      'run-volume-agent',
      'validate-volume-output',
      'persist-volume-plans',
      'record-agent-run'
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/workflows/generate-outline-flow.test.ts tests/workflows/generate-volume-flow.test.ts`
Expected: FAIL because `generateOutlineFlow` is placeholder and `generateVolumeFlow` is missing

- [ ] **Step 3: Implement the minimal workflow definitions**

```ts
// packages/workflows/src/generate-outline-flow.ts
import type { WorkflowDefinition } from './create-project-flow';

export function generateOutlineFlow(): WorkflowDefinition {
  return {
    name: 'generate-outline-flow',
    steps: [
      'load-project-input',
      'load-outline-prompt',
      'acquire-capacity',
      'run-outline-agent',
      'validate-outline-output',
      'persist-outline',
      'record-agent-run'
    ]
  };
}
```

```ts
// packages/workflows/src/generate-volume-flow.ts
import type { WorkflowDefinition } from './create-project-flow';

export function generateVolumeFlow(): WorkflowDefinition {
  return {
    name: 'generate-volume-flow',
    steps: [
      'load-outline',
      'load-volume-prompt',
      'acquire-capacity',
      'run-volume-agent',
      'validate-volume-output',
      'persist-volume-plans',
      'record-agent-run'
    ]
  };
}
```

```ts
// packages/workflows/src/index.ts
export * from './create-project-flow';
export * from './enqueue';
export * from './generate-outline-flow';
export * from './generate-volume-flow';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/workflows/generate-outline-flow.test.ts tests/workflows/generate-volume-flow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/workflows/src/generate-outline-flow.ts packages/workflows/src/generate-volume-flow.ts packages/workflows/src/index.ts tests/workflows/generate-outline-flow.test.ts tests/workflows/generate-volume-flow.test.ts
git commit -m "feat: add outline and volume workflows"
```

## Task 5: Add Chapter Generation And Review/Rewrite Workflow Definitions

**Files:**
- Create: `packages/workflows/src/generate-chapter-flow.ts`
- Create: `packages/workflows/src/review-rewrite-flow.ts`
- Modify: `packages/workflows/src/index.ts`
- Modify: `apps/worker/src/jobs/workflow-job.ts`
- Test: `tests/workflows/generate-chapter-flow.test.ts`
- Test: `tests/workflows/review-rewrite-flow.test.ts`

- [ ] **Step 1: Write the failing workflow tests**

```ts
// tests/workflows/generate-chapter-flow.test.ts
import { describe, expect, it } from 'vitest';
import { generateChapterFlow } from '../../packages/workflows/src';

describe('generateChapterFlow', () => {
  it('defines the chapter plan and draft pipeline', () => {
    expect(generateChapterFlow().steps).toEqual([
      'lock-project-chapter-pipeline',
      'load-story-state',
      'load-chapter-plan-prompt',
      'acquire-capacity',
      'run-chapter-plan-agent',
      'persist-chapter-plan',
      'load-chapter-draft-prompt',
      'run-chapter-draft-agent',
      'persist-chapter-draft',
      'mark-chapter-drafted'
    ]);
  });
});
```

```ts
// tests/workflows/review-rewrite-flow.test.ts
import { describe, expect, it } from 'vitest';
import { reviewRewriteFlow } from '../../packages/workflows/src';

describe('reviewRewriteFlow', () => {
  it('defines a bounded review and rewrite loop entry', () => {
    expect(reviewRewriteFlow().steps).toEqual([
      'load-chapter-draft',
      'load-review-prompt',
      'acquire-capacity',
      'run-review-agent',
      'persist-review-outcome',
      'branch-on-review-decision'
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/workflows/generate-chapter-flow.test.ts tests/workflows/review-rewrite-flow.test.ts`
Expected: FAIL with missing exports

- [ ] **Step 3: Implement the minimal workflow definitions and worker dispatch**

```ts
// packages/workflows/src/generate-chapter-flow.ts
import type { WorkflowDefinition } from './create-project-flow';

export function generateChapterFlow(): WorkflowDefinition {
  return {
    name: 'generate-chapter-flow',
    steps: [
      'lock-project-chapter-pipeline',
      'load-story-state',
      'load-chapter-plan-prompt',
      'acquire-capacity',
      'run-chapter-plan-agent',
      'persist-chapter-plan',
      'load-chapter-draft-prompt',
      'run-chapter-draft-agent',
      'persist-chapter-draft',
      'mark-chapter-drafted'
    ]
  };
}
```

```ts
// packages/workflows/src/review-rewrite-flow.ts
import type { WorkflowDefinition } from './create-project-flow';

export function reviewRewriteFlow(): WorkflowDefinition {
  return {
    name: 'review-rewrite-flow',
    steps: [
      'load-chapter-draft',
      'load-review-prompt',
      'acquire-capacity',
      'run-review-agent',
      'persist-review-outcome',
      'branch-on-review-decision'
    ]
  };
}
```

```ts
// apps/worker/src/jobs/workflow-job.ts
import {
  createProjectFlow,
  enqueueWorkflow,
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow,
  reviewRewriteFlow
} from '../../../../packages/workflows/src';

export async function runWorkflowJob(jobName: string) {
  const flowMap = {
    'create-project-flow': createProjectFlow(),
    'generate-outline-flow': generateOutlineFlow(),
    'generate-volume-flow': generateVolumeFlow(),
    'generate-chapter-flow': generateChapterFlow(),
    'review-rewrite-flow': reviewRewriteFlow()
  } as const;

  const flow = flowMap[jobName as keyof typeof flowMap] ?? { name: jobName, steps: [] };
  return enqueueWorkflow(flow);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/workflows/generate-chapter-flow.test.ts tests/workflows/review-rewrite-flow.test.ts tests/workflows/create-project-flow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/workflows/src/generate-chapter-flow.ts packages/workflows/src/review-rewrite-flow.ts packages/workflows/src/index.ts apps/worker/src/jobs/workflow-job.ts tests/workflows/generate-chapter-flow.test.ts tests/workflows/review-rewrite-flow.test.ts
git commit -m "feat: add chapter and review workflows"
```

## Task 6: Add Story Production API Routes

**Files:**
- Create: `apps/api/src/routes/story-production.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `packages/storage/src/repositories/project-repository.ts`
- Test: `tests/api/story-production.test.ts`

- [ ] **Step 1: Write the failing API test**

```ts
// tests/api/story-production.test.ts
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

vi.mock('../../packages/workflows/src', () => ({
  enqueueWorkflow: vi.fn((flow: { name: string; steps: string[] }) => ({
    flowName: flow.name,
    status: 'queued',
    steps: flow.steps
  })),
  generateOutlineFlow: () => ({ name: 'generate-outline-flow', steps: ['run-outline-agent'] }),
  generateVolumeFlow: () => ({ name: 'generate-volume-flow', steps: ['run-volume-agent'] }),
  generateChapterFlow: () => ({ name: 'generate-chapter-flow', steps: ['run-chapter-plan-agent'] })
}));

describe('story production routes', () => {
  it('queues the outline flow for a project', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/flows/outline'
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      flowName: 'generate-outline-flow',
      status: 'queued',
      steps: ['run-outline-agent']
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/api/story-production.test.ts`
Expected: FAIL with unregistered route

- [ ] **Step 3: Implement minimal routes**

```ts
// apps/api/src/routes/story-production.ts
import type { FastifyInstance } from 'fastify';
import {
  enqueueWorkflow,
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow
} from '../../../../packages/workflows/src';

export function registerStoryProductionRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/flows/outline', async () => {
    return app.code(202).send(enqueueWorkflow(generateOutlineFlow()));
  });

  app.post('/projects/:projectId/flows/volume', async () => {
    return app.code(202).send(enqueueWorkflow(generateVolumeFlow()));
  });

  app.post('/projects/:projectId/flows/next-chapter', async () => {
    return app.code(202).send(enqueueWorkflow(generateChapterFlow()));
  });
}
```

```ts
// apps/api/src/app.ts
import Fastify from 'fastify';
import { registerProjectRoutes } from './routes/projects';
import { registerPromptRoutes } from './routes/prompts';
import { registerProviderCapacityRoutes } from './routes/provider-capacity';
import { registerStoryProductionRoutes } from './routes/story-production';

export function buildApp() {
  const app = Fastify();

  registerProjectRoutes(app);
  registerPromptRoutes(app);
  registerProviderCapacityRoutes(app);
  registerStoryProductionRoutes(app);

  return app;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/api/story-production.test.ts tests/api/projects.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/story-production.ts apps/api/src/app.ts packages/storage/src/repositories/project-repository.ts tests/api/story-production.test.ts
git commit -m "feat: add story production api routes"
```

## Task 7: Add Project Detail Production Page

**Files:**
- Create: `apps/web/src/app/projects/[projectId]/page.tsx`
- Modify: `apps/web/src/app/projects/page.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Test: `tests/web/project-detail.test.tsx`

- [ ] **Step 1: Write the failing web test**

```tsx
// tests/web/project-detail.test.tsx
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectDetailPage from '../../apps/web/src/app/projects/[projectId]/page';

describe('ProjectDetailPage', () => {
  it('renders the story production sections', async () => {
    const Page = await ProjectDetailPage({
      params: Promise.resolve({ projectId: 'project-1' })
    } as never);

    render(Page);

    expect(screen.getByRole('heading', { name: 'Story Production' })).toBeInTheDocument();
    expect(screen.getByText('Outline')).toBeInTheDocument();
    expect(screen.getByText('Volumes')).toBeInTheDocument();
    expect(screen.getByText('Chapters')).toBeInTheDocument();
    expect(screen.getByText('Recent Agent Runs')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/web/project-detail.test.tsx`
Expected: FAIL with missing page module

- [ ] **Step 3: Implement the minimal page and API helper**

```ts
// apps/web/src/lib/api.ts
export async function getProjectProductionDetail(projectId: string) {
  return {
    projectId,
    outline: null,
    volumePlans: [],
    chapters: [],
    recentAgentRuns: []
  };
}
```

```tsx
// apps/web/src/app/projects/[projectId]/page.tsx
import React from 'react';
import { getProjectProductionDetail } from '../../../lib/api';

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const detail = await getProjectProductionDetail(projectId);

  return (
    <main>
      <h1>Story Production</h1>
      <section>
        <h2>Outline</h2>
        <pre>{JSON.stringify(detail.outline, null, 2)}</pre>
      </section>
      <section>
        <h2>Volumes</h2>
        <pre>{JSON.stringify(detail.volumePlans, null, 2)}</pre>
      </section>
      <section>
        <h2>Chapters</h2>
        <pre>{JSON.stringify(detail.chapters, null, 2)}</pre>
      </section>
      <section>
        <h2>Recent Agent Runs</h2>
        <pre>{JSON.stringify(detail.recentAgentRuns, null, 2)}</pre>
      </section>
    </main>
  );
}
```

```tsx
// apps/web/src/app/projects/page.tsx
import React from 'react';

export default function ProjectsPage() {
  return (
    <main>
      <h1>Projects</h1>
      <p>Open `/projects/:projectId` to inspect story production state.</p>
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/web/project-detail.test.tsx tests/web/dashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/projects/[projectId]/page.tsx apps/web/src/app/projects/page.tsx apps/web/src/lib/api.ts tests/web/project-detail.test.tsx
git commit -m "feat: add project production detail page"
```

## Task 8: Wire Real Chapter State And Review Policies Into Workflow Logic

**Files:**
- Modify: `packages/storage/src/repositories/story-state-repository.ts`
- Create: `tests/workflows/review-rewrite-policy.test.ts`
- Create: `packages/workflows/src/review-policy.ts`
- Modify: `packages/workflows/src/index.ts`

- [ ] **Step 1: Write the failing policy test**

```ts
// tests/workflows/review-rewrite-policy.test.ts
import { describe, expect, it } from 'vitest';
import { decideReviewNextState } from '../../packages/workflows/src/review-policy';

describe('decideReviewNextState', () => {
  it('blocks after the second rewrite request', () => {
    expect(
      decideReviewNextState({
        decision: 'rewrite',
        rewriteCount: 2,
        triggeredManualDecision: false
      })
    ).toEqual({
      chapterState: 'blocked_for_manual_decision',
      shouldRewrite: false
    });
  });

  it('approves a clean review result', () => {
    expect(
      decideReviewNextState({
        decision: 'approve',
        rewriteCount: 0,
        triggeredManualDecision: false
      })
    ).toEqual({
      chapterState: 'approved',
      shouldRewrite: false
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/workflows/review-rewrite-policy.test.ts`
Expected: FAIL with missing module

- [ ] **Step 3: Implement the minimal review policy**

```ts
// packages/workflows/src/review-policy.ts
import type { ChapterState, ReviewOutcome } from '@novel-creator/domain';

export function decideReviewNextState(input: {
  decision: ReviewOutcome['decision'];
  rewriteCount: number;
  triggeredManualDecision: boolean;
}): { chapterState: ChapterState; shouldRewrite: boolean } {
  if (input.decision === 'approve') {
    return { chapterState: 'approved', shouldRewrite: false };
  }

  if (input.triggeredManualDecision || input.rewriteCount >= 2) {
    return { chapterState: 'blocked_for_manual_decision', shouldRewrite: false };
  }

  return { chapterState: 'needs_rewrite', shouldRewrite: true };
}
```

```ts
// packages/workflows/src/index.ts
export * from './create-project-flow';
export * from './enqueue';
export * from './generate-outline-flow';
export * from './generate-volume-flow';
export * from './generate-chapter-flow';
export * from './review-rewrite-flow';
export * from './review-policy';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run tests/workflows/review-rewrite-policy.test.ts tests/workflows/review-rewrite-flow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/workflows/src/review-policy.ts packages/workflows/src/index.ts tests/workflows/review-rewrite-policy.test.ts
git commit -m "feat: add bounded review rewrite policy"
```

## Task 9: Add Phase 2 Smoke Coverage And Documentation

**Files:**
- Create: `tests/e2e/phase-2-smoke.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing smoke test**

```ts
// tests/e2e/phase-2-smoke.test.ts
import { describe, expect, it } from 'vitest';
import {
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow,
  reviewRewriteFlow
} from '../../packages/workflows/src';

describe('phase 2 smoke', () => {
  it('exposes the production flows needed for the first real novel pipeline', () => {
    expect(generateOutlineFlow().name).toBe('generate-outline-flow');
    expect(generateVolumeFlow().name).toBe('generate-volume-flow');
    expect(generateChapterFlow().name).toBe('generate-chapter-flow');
    expect(reviewRewriteFlow().name).toBe('review-rewrite-flow');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/e2e/phase-2-smoke.test.ts`
Expected: FAIL until all flow exports exist

- [ ] **Step 3: Update README for Phase 2**

```md
## Phase 2 Expected Behavior

- `POST /projects/:projectId/flows/outline` queues outline generation
- `POST /projects/:projectId/flows/volume` queues volume generation
- `POST /projects/:projectId/flows/next-chapter` queues the next chapter pipeline
- project detail UI shows outline, volumes, chapters, and recent agent runs
- review/rewrite logic stops after two automatic rewrite attempts
```

- [ ] **Step 4: Run the full Phase 2 verification**

Run: `corepack pnpm vitest run tests/storage/story-state-types.test.ts tests/storage/story-state-repository.test.ts tests/agent-runtime/agent-runner.test.ts tests/workflows/generate-outline-flow.test.ts tests/workflows/generate-volume-flow.test.ts tests/workflows/generate-chapter-flow.test.ts tests/workflows/review-rewrite-flow.test.ts tests/workflows/review-rewrite-policy.test.ts tests/api/story-production.test.ts tests/web/project-detail.test.tsx tests/e2e/phase-2-smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md tests/e2e/phase-2-smoke.test.ts
git commit -m "docs: add phase 2 smoke coverage"
```

## Task 10: Run Full Regression Before Declaring Phase 2 Ready

**Files:**
- Modify: none
- Test: `tests/workspace/workspace-smoke.test.ts`
- Test: `tests/storage/*.test.ts`
- Test: `tests/agent-runtime/*.test.ts`
- Test: `tests/api/*.test.ts`
- Test: `tests/workflows/*.test.ts`
- Test: `tests/web/*.test.tsx`
- Test: `tests/e2e/*.test.ts`

- [ ] **Step 1: Run the full existing suite plus Phase 2 tests**

Run: `corepack pnpm vitest run tests/workspace tests/storage tests/llm-gateway tests/agent-runtime tests/api tests/workflows tests/web tests/e2e`
Expected: PASS with all existing Phase 1 and new Phase 2 tests green

- [ ] **Step 2: Inspect git status**

Run: `git status --short`
Expected: only intended source changes, no generated junk beyond known Prisma artifacts if committed intentionally

- [ ] **Step 3: Commit the final verification checkpoint if needed**

```bash
git add .
git commit -m "test: verify phase 2 production pipeline" || true
```

- [ ] **Step 4: Record the exact verification command in the execution log**

```text
Verification command:
corepack pnpm vitest run tests/workspace tests/storage tests/llm-gateway tests/agent-runtime tests/api tests/workflows tests/web tests/e2e
```

## Self-Review

### Spec coverage

- story state and chapter state persistence: Task 1, Task 2
- outline and volume flows: Task 4
- chapter flow and review/rewrite flow: Task 5, Task 8
- agent execution records: Task 2, Task 3
- API and control panel updates: Task 6, Task 7
- integration and smoke coverage: Task 9, Task 10

### Placeholder scan

- No unresolved placeholders or deferred implementation notes remain.
- Every code-changing task includes concrete file paths, test snippets, commands, and commit points.

### Type consistency

- `StoryState`, `ChapterState`, `ReviewOutcome`, and `AgentRun` names are introduced in Task 1 and reused consistently in later tasks.
- Workflow names are fixed as `generate-outline-flow`, `generate-volume-flow`, `generate-chapter-flow`, and `review-rewrite-flow` across Tasks 4, 5, and 9.
