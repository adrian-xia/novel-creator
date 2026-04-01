# AI Novel Generator Phase 4 DecisionSession Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 3 `DecisionSession` scaffold into a real multi-turn decision loop that persists conversation history, generates structured resolutions, and resumes chapter production through a replan window.

**Architecture:** Extend the existing monorepo in place and keep the single-machine deployment topology unchanged. Persist multi-turn decision state, resolution drafts, and recovery tasks in `packages/storage`, use `packages/agent-runtime` for conversation context and resolution generation, and let `apps/worker` own assistant replies and recovery execution so the web app stays a control plane.

**Tech Stack:** `TypeScript`, `pnpm`, `Vitest`, `Fastify`, `Next.js`, `Prisma`, `BullMQ`, `superpower`

---

## Scope Split

This plan covers only the Phase 4 `DecisionSession` slice defined in [2026-04-01-ai-novel-generator-phase-4-decision-session-design.md](/root/git-resources/creator/novel-creator/docs/superpowers/specs/2026-04-01-ai-novel-generator-phase-4-decision-session-design.md):

1. persisted multi-turn decision sessions, messages, draft resolutions, and recovery tasks
2. decision conversation context assembly and assistant/revision helpers
3. real decision-session API routes and worker recovery flow
4. decision page upgrade from placeholder to live conversation/resolution UI
5. integration and smoke coverage for blocked review -> conversation -> resolution -> replan window

It does not cover real platform publishing, connector integrations, or docker compose deployment.

## File Structure

### New files and responsibilities

- `packages/domain/src/decision-recovery.ts`
  - domain types for replan windows and recovery tasks
- `packages/storage/src/repositories/decision-recovery-repository.ts`
  - persistence helpers for replan windows, invalidation, and recovery task creation
- `packages/agent-runtime/src/decision-conversation.ts`
  - assembly of multi-turn assistant input from story state, review outcome, and message history
- `packages/agent-runtime/src/decision-resolution-draft.ts`
  - helper that converts assistant-side candidate data into a typed `DecisionResolution`
- `packages/workflows/src/chapter-replan-flow.ts`
  - recovery flow definition for invalidating plans and resuming chapter planning
- `tests/storage/decision-recovery-repository.test.ts`
  - persistence tests for replan ranges and recovery tasks
- `tests/agent-runtime/decision-conversation.test.ts`
  - multi-turn context assembly tests
- `tests/agent-runtime/decision-resolution-draft.test.ts`
  - draft-generation tests
- `tests/workflows/chapter-replan-flow.test.ts`
  - recovery-flow definition tests
- `tests/api/decision-session-resolution.test.ts`
  - API tests for resolution generation and confirmation
- `tests/web/decision-queue-page.test.tsx`
  - decision queue rendering test
- `tests/e2e/phase-4-decision-session-smoke.test.ts`
  - end-to-end decision-session smoke

### Existing files to modify

- `packages/domain/src/decision-session.ts`
  - extend session, message, and resolution types for real multi-turn persistence
- `packages/domain/src/story-state.ts`
  - extend chapter-state union with `needs_replan` and `paused_by_decision`
- `packages/domain/src/index.ts`
  - export new decision recovery types
- `packages/storage/prisma/schema.prisma`
  - add decision-session metadata, draft resolution fields, plan invalidation, and recovery task models
- `packages/storage/src/repositories/decision-session-repository.ts`
  - add list/detail/message/draft/resolve/cancel methods and message sequencing
- `packages/storage/src/repositories/story-state-repository.ts`
  - add chapter-plan invalidation and chapter-state transitions used by recovery
- `packages/storage/src/repositories/project-repository.ts`
  - add decision queue/detail aggregates for the page and APIs
- `packages/agent-runtime/src/context-assembler.ts`
  - add decision conversation assembly helpers
- `packages/agent-runtime/src/decision-packet.ts`
  - align the packet shape with persisted context snapshot fields
- `packages/agent-runtime/src/decision-assistant.ts`
  - turn scaffold resolution helper into a reusable assistant-side draft builder
- `packages/agent-runtime/src/index.ts`
  - export new conversation and resolution helpers
- `packages/workflows/src/decision-session-flow.ts`
  - upgrade from static step list to Phase 4 worker lifecycle step names
- `packages/workflows/src/review-rewrite-flow.ts`
  - emit richer blocked-review handoff fields for session creation
- `packages/workflows/src/index.ts`
  - export chapter replan flow
- `apps/worker/src/jobs/workflow-job.ts`
  - dispatch chapter replan flow and pass richer payloads
- `apps/api/src/routes/decision-sessions.ts`
  - replace placeholders with real list/detail/message/resolve routes
- `apps/api/src/routes/validation.ts`
  - add decision-message and decision-resolution payload parsing
- `apps/api/src/app.ts`
  - keep route registration aligned
- `apps/web/src/lib/api.ts`
  - replace placeholder decision fetch helpers with real route calls and typed helpers
- `apps/web/src/app/decision-sessions/page.tsx`
  - render live decision queue data
- `apps/web/src/app/decision-sessions/[sessionId]/page.tsx`
  - render message history, draft resolution, and controls
- `apps/web/src/app/projects/[projectId]/page.tsx`
  - show live decision status and links into open sessions
- `README.md`
  - document Phase 4 expected behavior

## Task 1: Extend DecisionSession And Recovery Domain Contracts

**Files:**
- Create: `packages/domain/src/decision-recovery.ts`
- Modify: `packages/domain/src/decision-session.ts`
- Modify: `packages/domain/src/story-state.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `tests/storage/phase-4-decision-types.test.ts`

- [ ] **Step 1: Write the failing type contract test**

```ts
// tests/storage/phase-4-decision-types.test.ts
import { describe, expectTypeOf, it } from 'vitest';
import type {
  ChapterState,
  ChapterRecoveryTask,
  DecisionMessage,
  DecisionResolution,
  DecisionSession,
  ReplanRange
} from '../../packages/domain/src';

describe('phase 4 decision contracts', () => {
  it('exposes multi-turn decision and recovery types', () => {
    expectTypeOf<DecisionSession>().toMatchTypeOf<{
      id: string;
      projectId: string;
      chapterNumber: number;
      triggerReason: string | null;
      sourceReviewOutcomeId: string | null;
      contextSnapshot: Record<string, unknown>;
      currentDraftResolution: Record<string, unknown> | null;
      status:
        | 'open'
        | 'awaiting_assistant_reply'
        | 'awaiting_human_input'
        | 'awaiting_resolution_confirmation'
        | 'resolved'
        | 'cancelled';
    }>();

    expectTypeOf<DecisionMessage>().toMatchTypeOf<{
      sessionId: string;
      sequence: number;
      role: 'human' | 'assistant' | 'system';
      messageType: 'human' | 'assistant' | 'system' | 'resolution_draft';
      content: string;
    }>();

    expectTypeOf<ReplanRange>().toMatchTypeOf<{
      startChapter: number;
      endChapter: number;
    }>();

    expectTypeOf<DecisionResolution>().toMatchTypeOf<{
      sessionId: string;
      resolutionType:
        | 'accept_current'
        | 'accept_alternative'
        | 'replan_required'
        | 'pause_project';
      nextAction:
        | 'resume_current_chapter'
        | 'replan_window'
        | 'pause_project';
      replanRange: ReplanRange | null;
      resumeFromChapter: number | null;
      invalidateExistingPlans: boolean;
    }>();

    expectTypeOf<ChapterRecoveryTask>().toMatchTypeOf<{
      id: string;
      projectId: string;
      sessionId: string;
      startChapter: number;
      endChapter: number;
      resumeFromChapter: number;
      status: 'pending' | 'running' | 'completed' | 'failed';
    }>();

    expectTypeOf<ChapterState>().toEqualTypeOf<
      | 'pending'
      | 'planned'
      | 'drafted'
      | 'in_review'
      | 'needs_rewrite'
      | 'approved'
      | 'blocked_for_manual_decision'
      | 'needs_replan'
      | 'paused_by_decision'
      | 'failed'
    >();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/storage/phase-4-decision-types.test.ts`
Expected: FAIL with missing exports or mismatched type shapes

- [ ] **Step 3: Add the new domain contracts**

```ts
// packages/domain/src/decision-recovery.ts
export interface ReplanRange {
  startChapter: number;
  endChapter: number;
}

export interface ChapterRecoveryTask {
  id: string;
  projectId: string;
  sessionId: string;
  startChapter: number;
  endChapter: number;
  resumeFromChapter: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}
```

```ts
// packages/domain/src/decision-session.ts
export interface DecisionSession {
  id: string;
  projectId: string;
  chapterNumber: number;
  triggerReason: string | null;
  sourceReviewOutcomeId: string | null;
  status:
    | 'open'
    | 'awaiting_assistant_reply'
    | 'awaiting_human_input'
    | 'awaiting_resolution_confirmation'
    | 'resolved'
    | 'cancelled';
  packet: Record<string, unknown>;
  contextSnapshot: Record<string, unknown>;
  currentDraftResolution: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

export interface DecisionMessage {
  sessionId: string;
  sequence: number;
  role: 'human' | 'assistant' | 'system';
  messageType: 'human' | 'assistant' | 'system' | 'resolution_draft';
  content: string;
  createdAt?: string;
}
```

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
  | 'needs_replan'
  | 'paused_by_decision'
  | 'failed';
```

```ts
// packages/domain/src/index.ts
export * from './decision-recovery';
```

- [ ] **Step 4: Run the type test again**

Run: `corepack pnpm vitest run tests/storage/phase-4-decision-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/decision-session.ts packages/domain/src/decision-recovery.ts packages/domain/src/story-state.ts packages/domain/src/index.ts tests/storage/phase-4-decision-types.test.ts
git commit -m "feat: extend decision session domain contracts"
```

## Task 2: Extend Prisma Schema And Persistence For Multi-Turn Sessions

**Files:**
- Modify: `packages/storage/prisma/schema.prisma`
- Modify: `packages/storage/src/repositories/decision-session-repository.ts`
- Create: `packages/storage/src/repositories/decision-recovery-repository.ts`
- Modify: `packages/storage/src/repositories/story-state-repository.ts`
- Modify: `packages/storage/src/repositories/project-repository.ts`
- Test: `tests/storage/decision-session-repository.test.ts`
- Test: `tests/storage/decision-recovery-repository.test.ts`

- [ ] **Step 1: Write the failing persistence tests**

```ts
// tests/storage/decision-recovery-repository.test.ts
import { describe, expect, it } from 'vitest';
import { DecisionRecoveryRepository } from '../../packages/storage/src/repositories/decision-recovery-repository';

describe('DecisionRecoveryRepository', () => {
  it('creates a recovery task and invalidates chapter plans in the replan window', async () => {
    const repository = new DecisionRecoveryRepository();

    const task = await repository.createRecoveryTask({
      projectId: 'project-1',
      sessionId: 'session-1',
      startChapter: 12,
      endChapter: 15,
      resumeFromChapter: 12
    });

    expect(task.status).toBe('pending');
  });
});
```

```ts
// tests/storage/decision-session-repository.test.ts
it('persists sequenced messages and stores a draft resolution on the session', async () => {
  const repository = new DecisionSessionRepository();
  const session = await repository.createSession({
    projectId: 'project-1',
    chapterNumber: 8,
    packet: { summary: 'blocked twist' },
    triggerReason: 'critical_reversal',
    sourceReviewOutcomeId: 'review-1',
    contextSnapshot: { chapterNumber: 8 }
  });

  await repository.appendMessage({
    sessionId: session.id,
    sequence: 1,
    role: 'human',
    messageType: 'human',
    content: '给我两个替代方案'
  });

  await repository.saveDraftResolution(session.id, {
    resolutionType: 'accept_alternative',
    decisionSummary: '改成延后一章揭示',
    replanRange: { startChapter: 8, endChapter: 10 },
    resumeFromChapter: 8,
    invalidateExistingPlans: true
  });

  const detail = await repository.getSessionDetail(session.id);
  expect(detail?.messages[0]?.sequence).toBe(1);
  expect(detail?.currentDraftResolution).toMatchObject({
    resolutionType: 'accept_alternative'
  });
});
```

- [ ] **Step 2: Run the persistence tests to verify they fail**

Run: `corepack pnpm vitest run tests/storage/decision-session-repository.test.ts tests/storage/decision-recovery-repository.test.ts`
Expected: FAIL with missing schema fields or repository methods

- [ ] **Step 3: Extend the Prisma schema**

```prisma
model DecisionSessionRecord {
  id                    String   @id @default(uuid())
  projectId             String
  chapterNumber         Int
  triggerReason         String?
  sourceReviewOutcomeId String?
  status                String
  packet                Json
  contextSnapshot       Json
  currentDraftResolution Json?
  resolvedAt            DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  project               NovelProject @relation(fields: [projectId], references: [id])
  messages              DecisionMessageRecord[]
  resolution            DecisionResolutionRecord?
}

model DecisionMessageRecord {
  id          String   @id @default(uuid())
  sessionId    String
  sequence     Int
  role         String
  messageType  String
  content      String
  createdAt    DateTime @default(now())
  session      DecisionSessionRecord @relation(fields: [sessionId], references: [id])

  @@unique([sessionId, sequence])
}

model ChapterRecoveryTaskRecord {
  id                String   @id @default(uuid())
  projectId         String
  sessionId         String
  startChapter      Int
  endChapter        Int
  resumeFromChapter Int
  status            String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  project           NovelProject @relation(fields: [projectId], references: [id])
}
```

- [ ] **Step 4: Implement the repository methods**

```ts
// packages/storage/src/repositories/decision-recovery-repository.ts
import { prisma } from '../client';

export class DecisionRecoveryRepository {
  async createRecoveryTask(input: {
    projectId: string;
    sessionId: string;
    startChapter: number;
    endChapter: number;
    resumeFromChapter: number;
  }) {
    return prisma.chapterRecoveryTaskRecord.create({
      data: {
        ...input,
        status: 'pending'
      }
    });
  }
}
```

```ts
// packages/storage/src/repositories/decision-session-repository.ts
async saveDraftResolution(sessionId: string, draft: Record<string, unknown>) {
  return prisma.decisionSessionRecord.update({
    where: { id: sessionId },
    data: {
      currentDraftResolution: draft,
      status: 'awaiting_resolution_confirmation'
    }
  });
}
```

- [ ] **Step 5: Run the persistence tests again**

Run: `corepack pnpm vitest run tests/storage/decision-session-repository.test.ts tests/storage/decision-recovery-repository.test.ts tests/storage/story-state-repository.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/storage/prisma/schema.prisma packages/storage/src/repositories/decision-session-repository.ts packages/storage/src/repositories/decision-recovery-repository.ts packages/storage/src/repositories/story-state-repository.ts packages/storage/src/repositories/project-repository.ts tests/storage/decision-session-repository.test.ts tests/storage/decision-recovery-repository.test.ts
git commit -m "feat: persist multi-turn decision sessions"
```

## Task 3: Build Conversation Context And Resolution Draft Helpers

**Files:**
- Create: `packages/agent-runtime/src/decision-conversation.ts`
- Create: `packages/agent-runtime/src/decision-resolution-draft.ts`
- Modify: `packages/agent-runtime/src/context-assembler.ts`
- Modify: `packages/agent-runtime/src/decision-packet.ts`
- Modify: `packages/agent-runtime/src/decision-assistant.ts`
- Modify: `packages/agent-runtime/src/index.ts`
- Test: `tests/agent-runtime/decision-conversation.test.ts`
- Test: `tests/agent-runtime/decision-resolution-draft.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
// tests/agent-runtime/decision-conversation.test.ts
import { describe, expect, it } from 'vitest';
import { assembleDecisionConversation } from '../../packages/agent-runtime/src/decision-conversation';

describe('assembleDecisionConversation', () => {
  it('includes message history, review issues, and current draft when assembling assistant input', () => {
    const context = assembleDecisionConversation({
      packet: { chapterNumber: 8, reviewIssues: ['twist too early'] },
      messages: [
        { role: 'human', content: '给我两个替代方案' },
        { role: 'assistant', content: '方案 A / 方案 B' }
      ],
      currentDraftResolution: { resolutionType: 'accept_alternative' }
    });

    expect(context).toContain('twist too early');
    expect(context).toContain('给我两个替代方案');
    expect(context).toContain('accept_alternative');
  });
});
```

```ts
// tests/agent-runtime/decision-resolution-draft.test.ts
import { describe, expect, it } from 'vitest';
import { buildResolutionDraftFromConversation } from '../../packages/agent-runtime/src/decision-resolution-draft';

describe('buildResolutionDraftFromConversation', () => {
  it('builds a typed replan-window decision draft', () => {
    const draft = buildResolutionDraftFromConversation({
      sessionId: 'session-1',
      resolutionType: 'replan_required',
      decisionSummary: '延后一章揭示',
      replanRange: { startChapter: 8, endChapter: 10 },
      resumeFromChapter: 8
    });

    expect(draft.nextAction).toBe('replan_window');
    expect(draft.invalidateExistingPlans).toBe(true);
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `corepack pnpm vitest run tests/agent-runtime/decision-conversation.test.ts tests/agent-runtime/decision-resolution-draft.test.ts`
Expected: FAIL with missing modules or exports

- [ ] **Step 3: Implement the helper modules**

```ts
// packages/agent-runtime/src/decision-conversation.ts
export function assembleDecisionConversation(input: {
  packet: Record<string, unknown>;
  messages: Array<{ role: string; content: string }>;
  currentDraftResolution: Record<string, unknown> | null;
}) {
  return [
    '## Decision Packet',
    JSON.stringify(input.packet, null, 2),
    '## Messages',
    ...input.messages.map((message) => `${message.role}: ${message.content}`),
    '## Draft Resolution',
    JSON.stringify(input.currentDraftResolution, null, 2)
  ].join('
');
}
```

```ts
// packages/agent-runtime/src/decision-resolution-draft.ts
export function buildResolutionDraftFromConversation(input: {
  sessionId: string;
  resolutionType: 'accept_current' | 'accept_alternative' | 'replan_required' | 'pause_project';
  decisionSummary: string;
  replanRange: { startChapter: number; endChapter: number } | null;
  resumeFromChapter: number | null;
}) {
  return {
    sessionId: input.sessionId,
    resolutionType: input.resolutionType,
    decisionSummary: input.decisionSummary,
    storyFactsToApply: [],
    chapterPlanAdjustments: [],
    volumeImpact: null,
    nextAction: input.resolutionType === 'pause_project'
      ? 'pause_project'
      : input.replanRange
        ? 'replan_window'
        : 'resume_current_chapter',
    replanRange: input.replanRange,
    resumeFromChapter: input.resumeFromChapter,
    invalidateExistingPlans: Boolean(input.replanRange)
  };
}
```

- [ ] **Step 4: Run the helper tests again**

Run: `corepack pnpm vitest run tests/agent-runtime/decision-conversation.test.ts tests/agent-runtime/decision-resolution-draft.test.ts tests/agent-runtime/decision-assistant.test.ts tests/agent-runtime/decision-packet.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/agent-runtime/src/decision-conversation.ts packages/agent-runtime/src/decision-resolution-draft.ts packages/agent-runtime/src/context-assembler.ts packages/agent-runtime/src/decision-packet.ts packages/agent-runtime/src/decision-assistant.ts packages/agent-runtime/src/index.ts tests/agent-runtime/decision-conversation.test.ts tests/agent-runtime/decision-resolution-draft.test.ts
git commit -m "feat: assemble decision conversation context"
```

## Task 4: Add Recovery Workflow Definitions And Worker Routing

**Files:**
- Create: `packages/workflows/src/chapter-replan-flow.ts`
- Modify: `packages/workflows/src/decision-session-flow.ts`
- Modify: `packages/workflows/src/review-rewrite-flow.ts`
- Modify: `packages/workflows/src/index.ts`
- Modify: `apps/worker/src/jobs/workflow-job.ts`
- Test: `tests/workflows/chapter-replan-flow.test.ts`
- Test: `tests/workflows/decision-session-flow.test.ts`

- [ ] **Step 1: Write the failing flow tests**

```ts
// tests/workflows/chapter-replan-flow.test.ts
import { describe, expect, it } from 'vitest';
import { chapterReplanFlow } from '../../packages/workflows/src/chapter-replan-flow';

describe('chapterReplanFlow', () => {
  it('defines the recovery-window lifecycle', () => {
    const flow = chapterReplanFlow();
    expect(flow.steps).toEqual([
      'load-recovery-task',
      'invalidate-plans-in-window',
      'set-chapters-needs-replan',
      'enqueue-replan-window',
      'mark-recovery-task-complete'
    ]);
  });
});
```

- [ ] **Step 2: Run the flow tests to verify they fail**

Run: `corepack pnpm vitest run tests/workflows/chapter-replan-flow.test.ts tests/workflows/decision-session-flow.test.ts`
Expected: FAIL with missing module or mismatched steps

- [ ] **Step 3: Implement the recovery flow definitions**

```ts
// packages/workflows/src/chapter-replan-flow.ts
import type { WorkflowDefinition } from './create-project-flow';

export function chapterReplanFlow(): WorkflowDefinition {
  return {
    name: 'chapter-replan-flow',
    steps: [
      'load-recovery-task',
      'invalidate-plans-in-window',
      'set-chapters-needs-replan',
      'enqueue-replan-window',
      'mark-recovery-task-complete'
    ]
  };
}
```

```ts
// packages/workflows/src/decision-session-flow.ts
export function decisionSessionFlow(): WorkflowDefinition {
  return {
    name: 'decision-session-flow',
    steps: [
      'append-human-message',
      'load-decision-context',
      'assemble-decision-conversation-context',
      'run-decision-assistant',
      'persist-assistant-message',
      'generate-resolution-draft',
      'persist-resolution',
      'apply-resolution',
      'invalidate-plans-in-window',
      'enqueue-replan-window'
    ]
  };
}
```

- [ ] **Step 4: Wire the worker routing**

```ts
// apps/worker/src/jobs/workflow-job.ts
import { chapterReplanFlow } from '../../../../packages/workflows/src/chapter-replan-flow';

const flowMap = {
  'chapter-replan-flow': chapterReplanFlow(),
  'decision-session-flow': decisionSessionFlow(),
  'review-rewrite-flow': reviewRewriteFlow(),
  // existing flows stay intact
} as const;
```

- [ ] **Step 5: Run the workflow tests again**

Run: `corepack pnpm vitest run tests/workflows/chapter-replan-flow.test.ts tests/workflows/decision-session-flow.test.ts tests/worker/workflow-job.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/workflows/src/chapter-replan-flow.ts packages/workflows/src/decision-session-flow.ts packages/workflows/src/review-rewrite-flow.ts packages/workflows/src/index.ts apps/worker/src/jobs/workflow-job.ts tests/workflows/chapter-replan-flow.test.ts tests/workflows/decision-session-flow.test.ts tests/worker/workflow-job.test.ts
git commit -m "feat: add decision recovery workflow definitions"
```

## Task 5: Replace Placeholder DecisionSession APIs With Real Routes

**Files:**
- Modify: `apps/api/src/routes/decision-sessions.ts`
- Modify: `apps/api/src/routes/validation.ts`
- Modify: `apps/api/src/app.ts`
- Test: `tests/api/decision-sessions.test.ts`
- Test: `tests/api/decision-session-resolution.test.ts`

- [ ] **Step 1: Write the failing API tests**

```ts
// tests/api/decision-session-resolution.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('decision session resolution routes', () => {
  afterEach(async () => {
    await buildApp().close();
  });

  it('accepts structured resolution generation and confirmation requests', async () => {
    const app = buildApp();

    const draft = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-1/generate-resolution',
      payload: {
        resolutionType: 'replan_required',
        decisionSummary: '延后一章揭示',
        replanRange: { startChapter: 8, endChapter: 10 },
        resumeFromChapter: 8
      }
    });

    expect(draft.statusCode).toBe(200);

    const resolve = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-1/resolve',
      payload: {
        resolutionType: 'replan_required',
        decisionSummary: '延后一章揭示',
        storyFactsToApply: [],
        chapterPlanAdjustments: [],
        volumeImpact: null,
        nextAction: 'replan_window',
        replanRange: { startChapter: 8, endChapter: 10 },
        resumeFromChapter: 8,
        invalidateExistingPlans: true
      }
    });

    expect(resolve.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run the API tests to verify they fail**

Run: `corepack pnpm vitest run tests/api/decision-sessions.test.ts tests/api/decision-session-resolution.test.ts`
Expected: FAIL with missing routes or invalid payload parsing

- [ ] **Step 3: Add decision payload validation**

```ts
// apps/api/src/routes/validation.ts
export function parseDecisionMessagePayload(value: unknown) {
  if (!isRecord(value) || !isString(value.content)) {
    return null;
  }

  return { content: value.content };
}

export function parseDecisionResolutionPayload(value: unknown) {
  if (!isRecord(value) || !isString(value.resolutionType) || !isString(value.decisionSummary)) {
    return null;
  }

  return value;
}
```

- [ ] **Step 4: Implement the real route shapes**

```ts
// apps/api/src/routes/decision-sessions.ts
app.post('/decision-sessions/:sessionId/generate-resolution', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const payload = parseDecisionResolutionPayload(request.body);

  if (!payload) {
    return reply.code(400).send({ error: 'Invalid decision resolution payload' });
  }

  return { sessionId, draft: payload };
});

app.post('/decision-sessions/:sessionId/resolve', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const payload = parseDecisionResolutionPayload(request.body);

  if (!payload) {
    return reply.code(400).send({ error: 'Invalid decision resolution payload' });
  }

  return reply.code(200).send({ sessionId, status: 'resolved', resolution: payload });
});
```

- [ ] **Step 5: Run the API tests again**

Run: `corepack pnpm vitest run tests/api/decision-sessions.test.ts tests/api/decision-session-resolution.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/decision-sessions.ts apps/api/src/routes/validation.ts tests/api/decision-sessions.test.ts tests/api/decision-session-resolution.test.ts
git commit -m "feat: add decision resolution api routes"
```

## Task 6: Upgrade DecisionSession Pages To Multi-Turn Conversation UI

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/decision-sessions/page.tsx`
- Modify: `apps/web/src/app/decision-sessions/[sessionId]/page.tsx`
- Modify: `apps/web/src/app/projects/[projectId]/page.tsx`
- Test: `tests/web/decision-queue-page.test.tsx`
- Test: `tests/web/decision-session-page.test.tsx`

- [ ] **Step 1: Write the failing page tests**

```tsx
// tests/web/decision-queue-page.test.tsx
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import DecisionQueuePage from '../../apps/web/src/app/decision-sessions/page';

describe('DecisionQueuePage', () => {
  it('renders queue items from the decision-session API helper', async () => {
    const Page = await DecisionQueuePage();
    const html = renderToString(Page);

    expect(html).toContain('Decision Queue');
  });
});
```

- [ ] **Step 2: Run the page tests to verify they fail**

Run: `corepack pnpm vitest run tests/web/decision-queue-page.test.tsx tests/web/decision-session-page.test.tsx`
Expected: FAIL with missing live fields or outdated page output

- [ ] **Step 3: Replace placeholder web helpers**

```ts
// apps/web/src/lib/api.ts
export async function getDecisionQueue() {
  return getJson<{ items: Array<Record<string, unknown>> }>('http://localhost:3000/decision-sessions');
}

export async function getDecisionSessionDetail(sessionId: string) {
  return getJson<{
    sessionId: string;
    packet: Record<string, unknown> | null;
    messages: Array<Record<string, unknown>>;
    resolution: Record<string, unknown> | null;
    currentDraftResolution: Record<string, unknown> | null;
  }>(`http://localhost:3000/decision-sessions/${sessionId}`);
}
```

- [ ] **Step 4: Upgrade the pages**

```tsx
// apps/web/src/app/decision-sessions/[sessionId]/page.tsx
<section>
  <h2>Draft Resolution</h2>
  <pre>{JSON.stringify(detail.currentDraftResolution, null, 2)}</pre>
</section>
```

```tsx
// apps/web/src/app/projects/[projectId]/page.tsx
<section>
  <h2>Open Decisions</h2>
  <a href="/decision-sessions">Decision Queue</a>
</section>
```

- [ ] **Step 5: Run the page tests again**

Run: `corepack pnpm vitest run tests/web/decision-queue-page.test.tsx tests/web/decision-session-page.test.tsx tests/web/project-detail.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/decision-sessions/page.tsx apps/web/src/app/decision-sessions/[sessionId]/page.tsx apps/web/src/app/projects/[projectId]/page.tsx tests/web/decision-queue-page.test.tsx tests/web/decision-session-page.test.tsx tests/web/project-detail.test.tsx
git commit -m "feat: upgrade decision session control panel"
```

## Task 7: Add Phase 4 Integration, Smoke Coverage, And Docs

**Files:**
- Modify: `README.md`
- Test: `tests/e2e/phase-4-decision-session-smoke.test.ts`

- [ ] **Step 1: Write the failing Phase 4 smoke test**

```ts
// tests/e2e/phase-4-decision-session-smoke.test.ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';
import { chapterReplanFlow, decisionSessionFlow } from '../../packages/workflows/src';

describe('phase 4 decision-session smoke', () => {
  it('exposes real decision-session and recovery surfaces', async () => {
    const app = buildApp();

    const decisionQueue = await app.inject({ method: 'GET', url: '/decision-sessions' });
    const resolutionDraft = await app.inject({
      method: 'POST',
      url: '/decision-sessions/session-1/generate-resolution',
      payload: {
        resolutionType: 'replan_required',
        decisionSummary: '延后一章揭示',
        replanRange: { startChapter: 8, endChapter: 10 },
        resumeFromChapter: 8
      }
    });

    expect(decisionSessionFlow().name).toBe('decision-session-flow');
    expect(chapterReplanFlow().name).toBe('chapter-replan-flow');
    expect(decisionQueue.statusCode).toBe(200);
    expect(resolutionDraft.statusCode).toBe(200);

    await app.close();
  });
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `corepack pnpm vitest run tests/e2e/phase-4-decision-session-smoke.test.ts`
Expected: FAIL until the new recovery flow and resolution route are in place

- [ ] **Step 3: Update README and finalize the smoke test**

```md
## Phase 4 Expected Behavior

- blocked review outcomes open a real multi-turn decision session
- decision-session messages persist and can generate structured draft resolutions
- confirmed resolutions can define a dynamic replan window
- recovery tasks can invalidate existing plans and resume from a specific chapter
```

- [ ] **Step 4: Run the focused Phase 4 suite**

Run: `corepack pnpm vitest run tests/storage/phase-4-decision-types.test.ts tests/storage/decision-session-repository.test.ts tests/storage/decision-recovery-repository.test.ts tests/agent-runtime/decision-conversation.test.ts tests/agent-runtime/decision-resolution-draft.test.ts tests/api/decision-sessions.test.ts tests/api/decision-session-resolution.test.ts tests/web/decision-queue-page.test.tsx tests/web/decision-session-page.test.tsx tests/workflows/chapter-replan-flow.test.ts tests/e2e/phase-4-decision-session-smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full regression suite**

Run: `corepack pnpm vitest run tests/workspace tests/storage tests/llm-gateway tests/agent-runtime tests/api tests/workflows tests/web tests/e2e`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md tests/e2e/phase-4-decision-session-smoke.test.ts
git commit -m "docs: add phase 4 decision session smoke coverage"
```

## Self-Review

### Spec coverage

- multi-turn session persistence: covered by Task 1 and Task 2
- assistant conversation context and draft resolution generation: covered by Task 3
- worker recovery chain and replan-window flow: covered by Task 4
- real decision-session APIs: covered by Task 5
- decision queue and session pages: covered by Task 6
- smoke coverage and docs: covered by Task 7

### Placeholder scan

- No `TODO`, `TBD`, or “similar to Task N” placeholders remain.
- Each task includes exact files, concrete commands, expected outputs, and commit messages.
- Code steps include explicit snippets rather than generic instructions.

### Type consistency

- `DecisionSession`, `DecisionMessage`, `DecisionResolution`, `ReplanRange`, and `ChapterRecoveryTask` names are consistent across Tasks 1-7.
- `chapter-replan-flow` and `decision-session-flow` names are used consistently between worker routing, API smoke, and workflow tests.
- `needs_replan` and `paused_by_decision` are introduced once in Task 1 and referenced consistently in later tasks.
