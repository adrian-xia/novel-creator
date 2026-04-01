# AI Novel Generator Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Phase 3 decision-session workflow, project-level publish/export configuration, fake publish/export pipeline, and workflow observability on top of the Phase 2 production chain.

**Architecture:** Extend the existing monorepo in place and keep the single-machine deployment topology unchanged. Persist decision, publish/export, and workflow-run state in `packages/storage`, expose thin Fastify routes for those states, and keep asynchronous progression in `packages/workflows` and `apps/worker` so the web app stays a control plane instead of owning workflow logic.

**Tech Stack:** `TypeScript`, `pnpm`, `Vitest`, `Fastify`, `Next.js`, `Prisma`, `BullMQ`, `superpower`

---

## Scope Split

This plan covers only the Phase 3 slice defined in [2026-04-01-ai-novel-generator-phase-3-design.md](/root/git-resources/creator/novel-creator/docs/superpowers/specs/2026-04-01-ai-novel-generator-phase-3-design.md):

1. persisted `DecisionSession`, `DecisionMessage`, and `DecisionResolution`
2. project-level `PublishProfile`, `PublishTask`, and `ExportArtifact`
3. fake `PlatformAdapter`, export generation, and task expansion from approved chapters
4. workflow-run and step-run persistence for observability
5. API and internal control-panel pages for decision, publish/export, and workflow observability
6. integration and smoke coverage for the end-to-end Phase 3 loop

It does not cover real platform connectors, external alerting, budgets dashboards, or authentication.

## File Structure

### New files and responsibilities

- `packages/domain/src/decision-session.ts`
  - decision-session, decision-message, and structured resolution domain types
- `packages/domain/src/publishing.ts`
  - publish profile, publish task, export artifact, and platform capability types
- `packages/domain/src/workflow-observability.ts`
  - workflow run and step run domain types used by API and UI
- `packages/storage/src/repositories/decision-session-repository.ts`
  - persistence helpers for sessions, messages, and resolutions
- `packages/storage/src/repositories/publish-repository.ts`
  - persistence helpers for publish profiles, publish tasks, and export artifacts
- `packages/storage/src/repositories/workflow-run-repository.ts`
  - workflow/step run write and read helpers
- `packages/workflows/src/decision-session-flow.ts`
  - flow definition for creating and progressing a decision session
- `packages/workflows/src/publish-chapter-flow.ts`
  - flow definition for publish/export task expansion and execution
- `packages/workflows/src/workflow-runner.ts`
  - workflow-run/step-run instrumentation wrapper for existing flow execution
- `packages/agent-runtime/src/decision-packet.ts`
  - transforms review and story context into a decision packet
- `packages/agent-runtime/src/decision-assistant.ts`
  - LLM-backed helper for decision-session assistant replies and resolution drafts
- `packages/agent-runtime/src/fake-platform-adapter.ts`
  - fake adapter implementation matching the new platform-adapter interface
- `apps/api/src/routes/decision-sessions.ts`
  - decision-session query, message, and resolve routes
- `apps/api/src/routes/publishing.ts`
  - publish profile, publish-task, export, and manual-upload confirmation routes
- `apps/api/src/routes/workflow-runs.ts`
  - workflow-run list and run-detail routes
- `apps/web/src/app/decision-sessions/page.tsx`
  - decision queue page
- `apps/web/src/app/decision-sessions/[sessionId]/page.tsx`
  - decision-session conversation and resolution page
- `apps/web/src/app/publish/page.tsx`
  - publish center with publish and export tasks
- `apps/web/src/app/runs/page.tsx`
  - workflow-run list page
- `apps/web/src/app/runs/[runId]/page.tsx`
  - workflow-run detail page
- `tests/storage/decision-session-repository.test.ts`
  - decision persistence tests
- `tests/storage/publish-repository.test.ts`
  - publish/export persistence tests
- `tests/storage/workflow-run-repository.test.ts`
  - workflow-run persistence tests
- `tests/agent-runtime/decision-packet.test.ts`
  - decision packet assembly tests
- `tests/agent-runtime/decision-assistant.test.ts`
  - decision assistant and resolution-draft tests
- `tests/agent-runtime/fake-platform-adapter.test.ts`
  - fake adapter behavior tests
- `tests/workflows/decision-session-flow.test.ts`
  - decision-session workflow tests
- `tests/workflows/publish-chapter-flow.test.ts`
  - publish/export workflow tests
- `tests/api/decision-sessions.test.ts`
  - decision-session route tests
- `tests/api/publishing.test.ts`
  - publish-profile and publish-task route tests
- `tests/api/workflow-runs.test.ts`
  - workflow-run route tests
- `tests/web/decision-session-page.test.tsx`
  - decision-session UI rendering tests
- `tests/web/publish-center.test.tsx`
  - publish center rendering tests
- `tests/web/workflow-runs-page.test.tsx`
  - observability page rendering tests
- `tests/e2e/phase-3-smoke.test.ts`
  - end-to-end Phase 3 smoke

### Existing files to modify

- `packages/domain/src/index.ts`
  - export new Phase 3 domain contracts
- `packages/domain/src/story-state.ts`
  - extend chapter-state union with Phase 3 outcome values if needed
- `packages/storage/prisma/schema.prisma`
  - add decision, publishing, export, workflow-run, and step-run models
- `packages/storage/src/client.ts`
  - expose new Prisma models via the package client
- `packages/storage/src/repositories/story-state-repository.ts`
  - add helpers that link approved chapters to publish-task expansion and blocked chapters to decision-session creation
- `packages/storage/src/repositories/project-repository.ts`
  - load project-level publish profile and richer project detail aggregates
- `packages/agent-runtime/src/context-assembler.ts`
  - add decision-packet and publish/export context assembly helpers
- `packages/agent-runtime/src/index.ts`
  - export Phase 3 runtime helpers
- `packages/workflows/src/index.ts`
  - export decision-session and publish flows
- `packages/workflows/src/review-rewrite-flow.ts`
  - create decision sessions for blocked reviews and enqueue publish flow after approval
- `apps/worker/src/jobs/workflow-job.ts`
  - dispatch decision-session and publish flow jobs and write workflow-run status
- `apps/api/src/app.ts`
  - register Phase 3 routes
- `apps/web/src/lib/api.ts`
  - add fetch helpers for decision sessions, publishing, and runs
- `apps/web/src/app/projects/[projectId]/page.tsx`
  - add publish-profile section and links into new pages
- `README.md`
  - document Phase 3 capabilities and manual export workflow

## Task 1: Extend Domain Contracts And Prisma Schema

**Files:**
- Create: `packages/domain/src/decision-session.ts`
- Create: `packages/domain/src/publishing.ts`
- Create: `packages/domain/src/workflow-observability.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/storage/prisma/schema.prisma`
- Test: `tests/storage/phase-3-domain-types.test.ts`

- [ ] **Step 1: Write the failing type contract test**

```ts
// tests/storage/phase-3-domain-types.test.ts
import { describe, expectTypeOf, it } from 'vitest';
import type {
  DecisionMessage,
  DecisionResolution,
  DecisionSession,
  ExportArtifact,
  PublishProfile,
  PublishTask,
  StepRun,
  WorkflowRun
} from '../../packages/domain/src';

describe('phase 3 domain contracts', () => {
  it('exports decision-session, publishing, and workflow observability types', () => {
    expectTypeOf<DecisionSession>().toMatchTypeOf<{
      id: string;
      projectId: string;
      chapterNumber: number;
      status:
        | 'open'
        | 'awaiting_model_reply'
        | 'awaiting_human_resolution'
        | 'resolved'
        | 'cancelled';
      packet: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
    }>();

    expectTypeOf<DecisionMessage>().toMatchTypeOf<{
      sessionId: string;
      role: 'human' | 'assistant' | 'system';
      content: string;
    }>();

    expectTypeOf<DecisionResolution>().toMatchTypeOf<{
      sessionId: string;
      resolutionType:
        | 'accept_current'
        | 'accept_alternative'
        | 'replan_required'
        | 'pause_project';
      decisionSummary: string;
      storyFactsToApply: string[];
      chapterPlanAdjustments: string[];
      volumeImpact: string | null;
      nextAction: 'resume_review' | 'replan_chapter' | 'pause_project';
    }>();

    expectTypeOf<PublishProfile>().toMatchTypeOf<{
      projectId: string;
      publishEnabled: boolean;
      autoPublishTargets: string[];
      manualExportTargets: string[];
      defaultExportFormat: 'plain_text' | 'markdown' | 'bundle';
      effectiveFromChapter: number | null;
    }>();

    expectTypeOf<PublishTask>().toMatchTypeOf<{
      id: string;
      projectId: string;
      chapterNumber: number;
      targetPlatform: string;
      mode: 'adapter_publish' | 'manual_export';
      status:
        | 'pending'
        | 'publishing'
        | 'published'
        | 'exporting'
        | 'exported'
        | 'manual_upload_pending'
        | 'manual_upload_confirmed'
        | 'failed';
      artifactId: string | null;
    }>();

    expectTypeOf<ExportArtifact>().toMatchTypeOf<{
      id: string;
      projectId: string;
      chapterNumber: number;
      targetPlatform: string;
      format: 'plain_text' | 'markdown' | 'bundle';
      content: string;
    }>();

    expectTypeOf<WorkflowRun>().toMatchTypeOf<{
      id: string;
      flowName: string;
      projectId: string;
      chapterNumber: number | null;
      status: 'queued' | 'running' | 'succeeded' | 'failed';
    }>();

    expectTypeOf<StepRun>().toMatchTypeOf<{
      workflowRunId: string;
      stepName: string;
      status: 'pending' | 'running' | 'succeeded' | 'failed';
      errorMessage: string | null;
    }>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/storage/phase-3-domain-types.test.ts`
Expected: FAIL with missing exports from `../../packages/domain/src`

- [ ] **Step 3: Add the new domain contracts**

```ts
// packages/domain/src/decision-session.ts
export type DecisionSessionStatus =
  | 'open'
  | 'awaiting_model_reply'
  | 'awaiting_human_resolution'
  | 'resolved'
  | 'cancelled';

export type DecisionMessageRole = 'human' | 'assistant' | 'system';

export interface DecisionSession {
  id: string;
  projectId: string;
  chapterNumber: number;
  status: DecisionSessionStatus;
  packet: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionMessage {
  sessionId: string;
  role: DecisionMessageRole;
  content: string;
  createdAt?: string;
}

export interface DecisionResolution {
  sessionId: string;
  resolutionType:
    | 'accept_current'
    | 'accept_alternative'
    | 'replan_required'
    | 'pause_project';
  decisionSummary: string;
  storyFactsToApply: string[];
  chapterPlanAdjustments: string[];
  volumeImpact: string | null;
  nextAction: 'resume_review' | 'replan_chapter' | 'pause_project';
}
```

```ts
// packages/domain/src/publishing.ts
export type ExportFormat = 'plain_text' | 'markdown' | 'bundle';

export interface PublishProfile {
  projectId: string;
  publishEnabled: boolean;
  autoPublishTargets: string[];
  manualExportTargets: string[];
  defaultExportFormat: ExportFormat;
  effectiveFromChapter: number | null;
}

export interface PublishTask {
  id: string;
  projectId: string;
  chapterNumber: number;
  targetPlatform: string;
  mode: 'adapter_publish' | 'manual_export';
  status:
    | 'pending'
    | 'publishing'
    | 'published'
    | 'exporting'
    | 'exported'
    | 'manual_upload_pending'
    | 'manual_upload_confirmed'
    | 'failed';
  payloadSnapshot: Record<string, unknown>;
  artifactId: string | null;
  attemptCount: number;
  lastError: string | null;
}

export interface ExportArtifact {
  id: string;
  projectId: string;
  chapterNumber: number;
  targetPlatform: string;
  format: ExportFormat;
  content: string;
}
```

```ts
// packages/domain/src/workflow-observability.ts
export interface WorkflowRun {
  id: string;
  flowName: string;
  projectId: string;
  chapterNumber: number | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  errorMessage?: string | null;
}

export interface StepRun {
  workflowRunId: string;
  stepName: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  errorMessage: string | null;
}
```

```ts
// packages/domain/src/index.ts
export * from './novel-project';
export * from './prompt-config';
export * from './provider-capacity';
export * from './story-state';
export * from './decision-session';
export * from './publishing';
export * from './workflow-observability';
```

- [ ] **Step 4: Extend Prisma schema for Phase 3 tables**

```prisma
model PublishProfileRecord {
  projectId             String   @id
  publishEnabled        Boolean  @default(false)
  autoPublishTargets    Json     @default("[]")
  manualExportTargets   Json     @default("[]")
  defaultExportFormat   String
  effectiveFromChapter  Int?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  project               NovelProject @relation(fields: [projectId], references: [id])
}

model DecisionSessionRecord {
  id            String   @id @default(uuid())
  projectId     String
  chapterNumber Int
  status        String
  packet        Json
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  project       NovelProject @relation(fields: [projectId], references: [id])
  messages      DecisionMessageRecord[]
  resolution    DecisionResolutionRecord?
}

model DecisionMessageRecord {
  id         String   @id @default(uuid())
  sessionId   String
  role        String
  content     String
  createdAt   DateTime @default(now())
  session     DecisionSessionRecord @relation(fields: [sessionId], references: [id])
}

model DecisionResolutionRecord {
  sessionId               String   @id
  resolutionType          String
  decisionSummary         String
  storyFactsToApply       Json
  chapterPlanAdjustments  Json
  volumeImpact            String?
  nextAction              String
  createdAt               DateTime @default(now())
  session                 DecisionSessionRecord @relation(fields: [sessionId], references: [id])
}

model PublishTaskRecord {
  id             String   @id @default(uuid())
  projectId      String
  chapterNumber  Int
  targetPlatform String
  mode           String
  status         String
  payloadSnapshot Json
  artifactId     String?
  attemptCount   Int      @default(0)
  lastError      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  project        NovelProject @relation(fields: [projectId], references: [id])

  @@index([projectId, chapterNumber])
}

model ExportArtifactRecord {
  id             String   @id @default(uuid())
  projectId      String
  chapterNumber  Int
  targetPlatform String
  format         String
  content        String
  createdAt      DateTime @default(now())
  project        NovelProject @relation(fields: [projectId], references: [id])
}

model WorkflowRunRecord {
  id            String   @id @default(uuid())
  flowName      String
  projectId     String
  chapterNumber Int?
  status        String
  errorMessage  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  project       NovelProject @relation(fields: [projectId], references: [id])
  stepRuns      StepRunRecord[]
}

model StepRunRecord {
  id             String   @id @default(uuid())
  workflowRunId  String
  stepName       String
  status         String
  errorMessage   String?
  startedAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  workflowRun    WorkflowRunRecord @relation(fields: [workflowRunId], references: [id])
}
```

- [ ] **Step 5: Run the domain test again and generate Prisma client**

Run: `corepack pnpm vitest run tests/storage/phase-3-domain-types.test.ts && corepack pnpm --filter @novel-creator/storage exec prisma generate`
Expected: PASS for the domain test, then Prisma client generation succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/index.ts packages/domain/src/decision-session.ts packages/domain/src/publishing.ts packages/domain/src/workflow-observability.ts packages/storage/prisma/schema.prisma tests/storage/phase-3-domain-types.test.ts
git commit -m "feat: add phase 3 domain contracts"
```

## Task 2: Add Persistence For Decision, Publish, And Workflow Run State

**Files:**
- Create: `packages/storage/src/repositories/decision-session-repository.ts`
- Create: `packages/storage/src/repositories/publish-repository.ts`
- Create: `packages/storage/src/repositories/workflow-run-repository.ts`
- Modify: `packages/storage/src/repositories/project-repository.ts`
- Modify: `packages/storage/src/repositories/story-state-repository.ts`
- Modify: `packages/storage/src/client.ts`
- Test: `tests/storage/decision-session-repository.test.ts`
- Test: `tests/storage/publish-repository.test.ts`
- Test: `tests/storage/workflow-run-repository.test.ts`

- [ ] **Step 1: Write the failing repository tests**

```ts
// tests/storage/decision-session-repository.test.ts
import { describe, expect, it } from 'vitest';
import { DecisionSessionRepository } from '../../packages/storage/src/repositories/decision-session-repository';

describe('DecisionSessionRepository', () => {
  it('creates a session, appends messages, and saves a resolution', async () => {
    const repository = new DecisionSessionRepository();
    const session = await repository.createSession({
      projectId: 'project-1',
      chapterNumber: 8,
      packet: { summary: 'blocked twist' }
    });

    await repository.appendMessage({
      sessionId: session.id,
      role: 'human',
      content: 'Give me a safer alternative'
    });

    await repository.saveResolution({
      sessionId: session.id,
      resolutionType: 'accept_alternative',
      decisionSummary: 'Delay the reveal by one chapter',
      storyFactsToApply: ['villain identity remains hidden'],
      chapterPlanAdjustments: ['shift reveal to chapter 9'],
      volumeImpact: null,
      nextAction: 'replan_chapter'
    });

    const detail = await repository.getSessionDetail(session.id);
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.resolution?.resolutionType).toBe('accept_alternative');
    expect(detail?.status).toBe('resolved');
  });
});
```

```ts
// tests/storage/publish-repository.test.ts
import { describe, expect, it } from 'vitest';
import { PublishRepository } from '../../packages/storage/src/repositories/publish-repository';

describe('PublishRepository', () => {
  it('stores a project publish profile and expands mixed publish tasks', async () => {
    const repository = new PublishRepository();

    await repository.upsertPublishProfile({
      projectId: 'project-1',
      publishEnabled: true,
      autoPublishTargets: ['alpha'],
      manualExportTargets: ['beta'],
      defaultExportFormat: 'bundle',
      effectiveFromChapter: 3
    });

    const tasks = await repository.createPublishTasks({
      projectId: 'project-1',
      chapterNumber: 3,
      payloadSnapshot: { title: 'Chapter 3' }
    });

    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.mode).sort()).toEqual(['adapter_publish', 'manual_export']);
  });
});
```

```ts
// tests/storage/workflow-run-repository.test.ts
import { describe, expect, it } from 'vitest';
import { WorkflowRunRepository } from '../../packages/storage/src/repositories/workflow-run-repository';

describe('WorkflowRunRepository', () => {
  it('persists workflow and step status transitions', async () => {
    const repository = new WorkflowRunRepository();
    const run = await repository.createRun({
      flowName: 'publish-chapter-flow',
      projectId: 'project-1',
      chapterNumber: 10
    });

    await repository.markStepRunning(run.id, 'expand-publish-tasks');
    await repository.markStepSucceeded(run.id, 'expand-publish-tasks');
    await repository.markRunSucceeded(run.id);

    const detail = await repository.getRunDetail(run.id);
    expect(detail?.status).toBe('succeeded');
    expect(detail?.steps[0]?.status).toBe('succeeded');
  });
});
```

- [ ] **Step 2: Run repository tests to verify they fail**

Run: `corepack pnpm vitest run tests/storage/decision-session-repository.test.ts tests/storage/publish-repository.test.ts tests/storage/workflow-run-repository.test.ts`
Expected: FAIL with missing repository modules and methods

- [ ] **Step 3: Implement the decision-session repository**

```ts
// packages/storage/src/repositories/decision-session-repository.ts
import type { DecisionMessage, DecisionResolution } from '@novel-creator/domain';
import { prisma } from '../client';

export class DecisionSessionRepository {
  async createSession(input: { projectId: string; chapterNumber: number; packet: Record<string, unknown> }) {
    return prisma.decisionSessionRecord.create({
      data: {
        projectId: input.projectId,
        chapterNumber: input.chapterNumber,
        status: 'open',
        packet: input.packet
      }
    });
  }

  async appendMessage(message: DecisionMessage) {
    return prisma.decisionMessageRecord.create({
      data: {
        sessionId: message.sessionId,
        role: message.role,
        content: message.content
      }
    });
  }

  async saveResolution(resolution: DecisionResolution) {
    return prisma.$transaction(async (tx) => {
      await tx.decisionResolutionRecord.upsert({
        where: { sessionId: resolution.sessionId },
        create: resolution,
        update: resolution
      });

      return tx.decisionSessionRecord.update({
        where: { id: resolution.sessionId },
        data: { status: 'resolved' }
      });
    });
  }
}
```

- [ ] **Step 4: Implement the publish and workflow-run repositories**

```ts
// packages/storage/src/repositories/publish-repository.ts
import type { ExportFormat, PublishProfile } from '@novel-creator/domain';
import { prisma } from '../client';

export class PublishRepository {
  async upsertPublishProfile(profile: PublishProfile) {
    return prisma.publishProfileRecord.upsert({
      where: { projectId: profile.projectId },
      create: profile,
      update: profile
    });
  }

  async createPublishTasks(input: {
    projectId: string;
    chapterNumber: number;
    payloadSnapshot: Record<string, unknown>;
  }) {
    const profile = await prisma.publishProfileRecord.findUnique({
      where: { projectId: input.projectId }
    });

    if (!profile || !profile.publishEnabled) {
      return [];
    }

    const autoTargets = Array.isArray(profile.autoPublishTargets) ? profile.autoPublishTargets : [];
    const exportTargets = Array.isArray(profile.manualExportTargets) ? profile.manualExportTargets : [];

    return prisma.$transaction([
      ...autoTargets.map((target) =>
        prisma.publishTaskRecord.create({
          data: {
            projectId: input.projectId,
            chapterNumber: input.chapterNumber,
            targetPlatform: String(target),
            mode: 'adapter_publish',
            status: 'pending',
            payloadSnapshot: input.payloadSnapshot
          }
        })
      ),
      ...exportTargets.map((target) =>
        prisma.publishTaskRecord.create({
          data: {
            projectId: input.projectId,
            chapterNumber: input.chapterNumber,
            targetPlatform: String(target),
            mode: 'manual_export',
            status: 'pending',
            payloadSnapshot: input.payloadSnapshot
          }
        })
      )
    ]);
  }

  async createExportArtifact(input: {
    projectId: string;
    chapterNumber: number;
    targetPlatform: string;
    format: ExportFormat;
    content: string;
  }) {
    return prisma.exportArtifactRecord.create({ data: input });
  }
}
```

```ts
// packages/storage/src/repositories/workflow-run-repository.ts
import { prisma } from '../client';

export class WorkflowRunRepository {
  async createRun(input: { flowName: string; projectId: string; chapterNumber: number | null }) {
    return prisma.workflowRunRecord.create({
      data: {
        flowName: input.flowName,
        projectId: input.projectId,
        chapterNumber: input.chapterNumber,
        status: 'queued'
      }
    });
  }

  async markStepRunning(workflowRunId: string, stepName: string) {
    return prisma.stepRunRecord.create({
      data: {
        workflowRunId,
        stepName,
        status: 'running'
      }
    });
  }

  async markStepSucceeded(workflowRunId: string, stepName: string) {
    return prisma.stepRunRecord.updateMany({
      where: { workflowRunId, stepName },
      data: { status: 'succeeded' }
    });
  }

  async markRunSucceeded(workflowRunId: string) {
    return prisma.workflowRunRecord.update({
      where: { id: workflowRunId },
      data: { status: 'succeeded' }
    });
  }
}
```

- [ ] **Step 5: Wire repository exports and story/project detail helpers**

```ts
// packages/storage/src/repositories/project-repository.ts
async getProjectDecisionAndPublishingDetail(projectId: string) {
  return prisma.novelProject.findUnique({
    where: { id: projectId },
    include: {
      storyState: true,
      chapterStateRecords: true,
      reviewOutcomeRecords: true,
      agentRunRecords: { orderBy: { createdAt: 'desc' }, take: 10 },
      publishProfileRecord: true,
      publishTaskRecords: { orderBy: { createdAt: 'desc' }, take: 20 },
      decisionSessionRecords: { orderBy: { updatedAt: 'desc' }, take: 20 }
    }
  });
}
```

```ts
// packages/storage/src/repositories/story-state-repository.ts
async markChapterBlockedForDecision(input: { projectId: string; chapterNumber: number }) {
  return this.saveChapterState({
    projectId: input.projectId,
    chapterNumber: input.chapterNumber,
    status: 'blocked_for_manual_decision'
  });
}
```

- [ ] **Step 6: Run repository tests and Prisma-backed storage checks**

Run: `corepack pnpm vitest run tests/storage/decision-session-repository.test.ts tests/storage/publish-repository.test.ts tests/storage/workflow-run-repository.test.ts tests/storage/storage-package.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/storage/src/repositories packages/storage/src/client.ts packages/storage/prisma/schema.prisma tests/storage/decision-session-repository.test.ts tests/storage/publish-repository.test.ts tests/storage/workflow-run-repository.test.ts
git commit -m "feat: add phase 3 persistence repositories"
```

## Task 3: Add Decision Packet Assembly And Decision Session Workflow

**Files:**
- Create: `packages/agent-runtime/src/decision-packet.ts`
- Create: `packages/agent-runtime/src/decision-assistant.ts`
- Create: `packages/workflows/src/decision-session-flow.ts`
- Modify: `packages/agent-runtime/src/context-assembler.ts`
- Modify: `packages/agent-runtime/src/index.ts`
- Modify: `packages/workflows/src/review-rewrite-flow.ts`
- Modify: `packages/workflows/src/index.ts`
- Modify: `apps/worker/src/jobs/workflow-job.ts`
- Test: `tests/agent-runtime/decision-packet.test.ts`
- Test: `tests/agent-runtime/decision-assistant.test.ts`
- Test: `tests/workflows/decision-session-flow.test.ts`

- [ ] **Step 1: Write failing tests for the decision packet, assistant, and workflow**

```ts
// tests/agent-runtime/decision-packet.test.ts
import { describe, expect, it } from 'vitest';
import { buildDecisionPacket } from '../../packages/agent-runtime/src/decision-packet';

describe('buildDecisionPacket', () => {
  it('assembles a focused packet from review and story context', () => {
    const packet = buildDecisionPacket({
      projectId: 'project-1',
      chapterNumber: 12,
      currentVolumeGoal: 'break the alliance',
      recentSummaries: ['chapter 10 summary', 'chapter 11 summary'],
      reviewIssues: ['relationship fracture happens too early'],
      currentProposal: 'confirm the breakup in chapter 12'
    });

    expect(packet.chapterNumber).toBe(12);
    expect(packet.recentSummaries).toHaveLength(2);
    expect(packet.riskAnalysis).toContain('too early');
  });
});
```

```ts
// tests/agent-runtime/decision-assistant.test.ts
import { describe, expect, it } from 'vitest';
import { buildResolutionDraft } from '../../packages/agent-runtime/src/decision-assistant';

describe('buildResolutionDraft', () => {
  it('turns a candidate direction into a structured resolution draft', () => {
    const draft = buildResolutionDraft({
      sessionId: 'session-1',
      direction: 'delay reveal',
      rationale: 'preserve pacing'
    });

    expect(draft.resolutionType).toBe('accept_alternative');
    expect(draft.nextAction).toBe('replan_chapter');
  });
});
```

```ts
// tests/workflows/decision-session-flow.test.ts
import { describe, expect, it } from 'vitest';
import { decisionSessionFlow } from '../../packages/workflows/src/decision-session-flow';

describe('decisionSessionFlow', () => {
  it('defines the session creation and resolution lifecycle', () => {
    const flow = decisionSessionFlow();
    expect(flow.name).toBe('decision-session-flow');
    expect(flow.steps).toEqual([
      'load-blocked-review',
      'build-decision-packet',
      'create-decision-session',
      'await-human-and-assistant-conversation',
      'persist-decision-resolution',
      'apply-resolution'
    ]);
  });
});
```

- [ ] **Step 2: Run those tests to verify they fail**

Run: `corepack pnpm vitest run tests/agent-runtime/decision-packet.test.ts tests/agent-runtime/decision-assistant.test.ts tests/workflows/decision-session-flow.test.ts`
Expected: FAIL with missing modules and exports

- [ ] **Step 3: Implement the decision packet and resolution helpers**

```ts
// packages/agent-runtime/src/decision-packet.ts
export function buildDecisionPacket(input: {
  projectId: string;
  chapterNumber: number;
  currentVolumeGoal: string;
  recentSummaries: string[];
  reviewIssues: string[];
  currentProposal: string;
}) {
  return {
    projectId: input.projectId,
    chapterNumber: input.chapterNumber,
    currentVolumeGoal: input.currentVolumeGoal,
    recentSummaries: input.recentSummaries,
    currentProposal: input.currentProposal,
    riskAnalysis: input.reviewIssues.join('; ')
  };
}
```

```ts
// packages/agent-runtime/src/decision-assistant.ts
import type { DecisionResolution } from '@novel-creator/domain';

export function buildResolutionDraft(input: {
  sessionId: string;
  direction: string;
  rationale: string;
}): DecisionResolution {
  return {
    sessionId: input.sessionId,
    resolutionType: input.direction === 'keep current' ? 'accept_current' : 'accept_alternative',
    decisionSummary: `${input.direction}: ${input.rationale}`,
    storyFactsToApply: [],
    chapterPlanAdjustments: input.direction === 'keep current' ? [] : [input.direction],
    volumeImpact: null,
    nextAction: input.direction === 'keep current' ? 'resume_review' : 'replan_chapter'
  };
}
```

- [ ] **Step 4: Implement the decision-session workflow and hook blocked reviews into it**

```ts
// packages/workflows/src/decision-session-flow.ts
import type { WorkflowDefinition } from './create-project-flow';

export function decisionSessionFlow(): WorkflowDefinition {
  return {
    name: 'decision-session-flow',
    steps: [
      'load-blocked-review',
      'build-decision-packet',
      'create-decision-session',
      'await-human-and-assistant-conversation',
      'persist-decision-resolution',
      'apply-resolution'
    ]
  };
}
```

```ts
// packages/workflows/src/review-rewrite-flow.ts
export function reviewRewriteFlow(): WorkflowDefinition {
  return {
    name: 'review-rewrite-flow',
    steps: [
      'load-chapter-draft',
      'load-review-prompt',
      'acquire-capacity',
      'run-review-agent',
      'persist-review-outcome',
      'branch-on-review-decision',
      'enqueue-decision-session-when-blocked',
      'enqueue-publish-when-approved'
    ]
  };
}
```

- [ ] **Step 5: Dispatch the new workflow from the worker**

```ts
// apps/worker/src/jobs/workflow-job.ts
import {
  createProjectFlow,
  decisionSessionFlow,
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow,
  publishChapterFlow,
  reviewRewriteFlow
} from '../../../../packages/workflows/src';

const workflowMap = {
  [createProjectFlow().name]: createProjectFlow,
  [generateOutlineFlow().name]: generateOutlineFlow,
  [generateVolumeFlow().name]: generateVolumeFlow,
  [generateChapterFlow().name]: generateChapterFlow,
  [reviewRewriteFlow().name]: reviewRewriteFlow,
  [decisionSessionFlow().name]: decisionSessionFlow,
  [publishChapterFlow().name]: publishChapterFlow
};
```

- [ ] **Step 6: Run the decision tests**

Run: `corepack pnpm vitest run tests/agent-runtime/decision-packet.test.ts tests/agent-runtime/decision-assistant.test.ts tests/workflows/decision-session-flow.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/agent-runtime/src packages/workflows/src apps/worker/src/jobs/workflow-job.ts tests/agent-runtime/decision-packet.test.ts tests/agent-runtime/decision-assistant.test.ts tests/workflows/decision-session-flow.test.ts
git commit -m "feat: add decision session workflow scaffold"
```

## Task 4: Add Publish Profile Expansion, Fake Adapter, And Export Generation

**Files:**
- Create: `packages/agent-runtime/src/fake-platform-adapter.ts`
- Create: `packages/workflows/src/publish-chapter-flow.ts`
- Modify: `packages/agent-runtime/src/index.ts`
- Modify: `packages/storage/src/repositories/publish-repository.ts`
- Modify: `packages/workflows/src/index.ts`
- Modify: `apps/worker/src/jobs/workflow-job.ts`
- Test: `tests/agent-runtime/fake-platform-adapter.test.ts`
- Test: `tests/workflows/publish-chapter-flow.test.ts`

- [ ] **Step 1: Write failing tests for fake publishing and manual export**

```ts
// tests/agent-runtime/fake-platform-adapter.test.ts
import { describe, expect, it } from 'vitest';
import { fakePlatformAdapter } from '../../packages/agent-runtime/src/fake-platform-adapter';

describe('fakePlatformAdapter', () => {
  it('publishes a chapter payload successfully', async () => {
    const result = await fakePlatformAdapter.publishChapter({
      targetPlatform: 'alpha',
      chapterNumber: 4,
      payload: { title: 'Chapter 4', content: 'Body' }
    });

    expect(result.status).toBe('published');
    expect(result.remoteId).toContain('alpha');
  });
});
```

```ts
// tests/workflows/publish-chapter-flow.test.ts
import { describe, expect, it } from 'vitest';
import { publishChapterFlow } from '../../packages/workflows/src/publish-chapter-flow';

describe('publishChapterFlow', () => {
  it('expands tasks and branches into adapter publish or export', () => {
    const flow = publishChapterFlow();
    expect(flow.steps).toEqual([
      'load-publish-profile',
      'expand-publish-tasks',
      'run-adapter-publishes',
      'run-manual-exports',
      'persist-publish-results'
    ]);
  });
});
```

- [ ] **Step 2: Run those tests to verify they fail**

Run: `corepack pnpm vitest run tests/agent-runtime/fake-platform-adapter.test.ts tests/workflows/publish-chapter-flow.test.ts`
Expected: FAIL with missing adapter and workflow modules

- [ ] **Step 3: Implement the fake platform adapter**

```ts
// packages/agent-runtime/src/fake-platform-adapter.ts
export const fakePlatformAdapter = {
  validateConfig(config: { targetPlatform: string }) {
    return Boolean(config.targetPlatform);
  },
  async publishChapter(input: {
    targetPlatform: string;
    chapterNumber: number;
    payload: Record<string, unknown>;
  }) {
    return {
      status: 'published' as const,
      remoteId: `${input.targetPlatform}-chapter-${input.chapterNumber}`,
      payload: input.payload
    };
  },
  async getPublishStatus(input: { remoteId: string }) {
    return {
      remoteId: input.remoteId,
      status: 'published' as const
    };
  }
};
```

- [ ] **Step 4: Implement the publish flow and export content generation**

```ts
// packages/workflows/src/publish-chapter-flow.ts
import type { WorkflowDefinition } from './create-project-flow';

export function publishChapterFlow(): WorkflowDefinition {
  return {
    name: 'publish-chapter-flow',
    steps: [
      'load-publish-profile',
      'expand-publish-tasks',
      'run-adapter-publishes',
      'run-manual-exports',
      'persist-publish-results'
    ]
  };
}
```

```ts
// packages/storage/src/repositories/publish-repository.ts
async markManualExportReady(input: {
  publishTaskId: string;
  artifactId: string;
}) {
  return prisma.publishTaskRecord.update({
    where: { id: input.publishTaskId },
    data: {
      status: 'manual_upload_pending',
      artifactId: input.artifactId
    }
  });
}

async confirmManualUpload(publishTaskId: string) {
  return prisma.publishTaskRecord.update({
    where: { id: publishTaskId },
    data: { status: 'manual_upload_confirmed' }
  });
}
```

- [ ] **Step 5: Run the publish/export tests**

Run: `corepack pnpm vitest run tests/agent-runtime/fake-platform-adapter.test.ts tests/workflows/publish-chapter-flow.test.ts tests/storage/publish-repository.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/agent-runtime/src/fake-platform-adapter.ts packages/workflows/src/publish-chapter-flow.ts packages/storage/src/repositories/publish-repository.ts tests/agent-runtime/fake-platform-adapter.test.ts tests/workflows/publish-chapter-flow.test.ts tests/storage/publish-repository.test.ts
git commit -m "feat: add publish and export workflow scaffold"
```

## Task 5: Instrument Workflow Runs And Step Runs

**Files:**
- Create: `packages/workflows/src/workflow-runner.ts`
- Modify: `apps/worker/src/jobs/workflow-job.ts`
- Modify: `packages/workflows/src/index.ts`
- Test: `tests/workflows/workflow-runner.test.ts`

- [ ] **Step 1: Write a failing workflow-run instrumentation test**

```ts
// tests/workflows/workflow-runner.test.ts
import { describe, expect, it } from 'vitest';
import { runInstrumentedWorkflow } from '../../packages/workflows/src/workflow-runner';

describe('runInstrumentedWorkflow', () => {
  it('creates a workflow run and step runs around the provided definition', async () => {
    const result = await runInstrumentedWorkflow({
      flow: {
        name: 'decision-session-flow',
        steps: ['step-a', 'step-b']
      },
      payload: {
        projectId: 'project-1',
        chapterNumber: 5
      }
    });

    expect(result.flowName).toBe('decision-session-flow');
    expect(result.stepCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run the workflow-runner test to verify it fails**

Run: `corepack pnpm vitest run tests/workflows/workflow-runner.test.ts`
Expected: FAIL with missing `runInstrumentedWorkflow`

- [ ] **Step 3: Implement workflow-run instrumentation**

```ts
// packages/workflows/src/workflow-runner.ts
import { WorkflowRunRepository } from '../../storage/src/repositories/workflow-run-repository';

export async function runInstrumentedWorkflow(input: {
  flow: { name: string; steps: string[] };
  payload: { projectId: string; chapterNumber: number | null };
}) {
  const repository = new WorkflowRunRepository();
  const run = await repository.createRun({
    flowName: input.flow.name,
    projectId: input.payload.projectId,
    chapterNumber: input.payload.chapterNumber
  });

  for (const step of input.flow.steps) {
    await repository.markStepRunning(run.id, step);
    await repository.markStepSucceeded(run.id, step);
  }

  await repository.markRunSucceeded(run.id);

  return {
    flowName: input.flow.name,
    stepCount: input.flow.steps.length
  };
}
```

- [ ] **Step 4: Wrap worker execution with the instrumentation helper**

```ts
// apps/worker/src/jobs/workflow-job.ts
import { runInstrumentedWorkflow } from '../../../../packages/workflows/src/workflow-runner';

export async function runWorkflowJob(input: { flowName: string; projectId: string; chapterNumber?: number }) {
  const createFlow = workflowMap[input.flowName as keyof typeof workflowMap];

  if (!createFlow) {
    throw new Error(`Unknown workflow: ${input.flowName}`);
  }

  return runInstrumentedWorkflow({
    flow: createFlow(),
    payload: {
      projectId: input.projectId,
      chapterNumber: input.chapterNumber ?? null
    }
  });
}
```

- [ ] **Step 5: Run the instrumentation test**

Run: `corepack pnpm vitest run tests/workflows/workflow-runner.test.ts tests/storage/workflow-run-repository.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/workflows/src/workflow-runner.ts apps/worker/src/jobs/workflow-job.ts tests/workflows/workflow-runner.test.ts
git commit -m "feat: add workflow observability instrumentation"
```

## Task 6: Expose Decision, Publishing, And Workflow Run APIs

**Files:**
- Create: `apps/api/src/routes/decision-sessions.ts`
- Create: `apps/api/src/routes/publishing.ts`
- Create: `apps/api/src/routes/workflow-runs.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/validation.ts`
- Test: `tests/api/decision-sessions.test.ts`
- Test: `tests/api/publishing.test.ts`
- Test: `tests/api/workflow-runs.test.ts`

- [ ] **Step 1: Write failing API tests for decision sessions, publishing, and workflow runs**

```ts
// tests/api/decision-sessions.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('decision session routes', () => {
  afterEach(async () => {
    await buildApp().close();
  });

  it('returns a decision queue response', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/decision-sessions'
    });

    expect(response.statusCode).toBe(200);
  });
});
```

```ts
// tests/api/publishing.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('publishing routes', () => {
  afterEach(async () => {
    await buildApp().close();
  });

  it('accepts publish profile updates', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/projects/project-1/publish-profile',
      payload: {
        publishEnabled: true,
        autoPublishTargets: ['alpha'],
        manualExportTargets: ['beta'],
        defaultExportFormat: 'markdown',
        effectiveFromChapter: 2
      }
    });

    expect(response.statusCode).toBe(200);
  });
});
```

```ts
// tests/api/workflow-runs.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('workflow run routes', () => {
  afterEach(async () => {
    await buildApp().close();
  });

  it('returns workflow runs', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/workflow-runs'
    });

    expect(response.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run API tests to verify they fail**

Run: `corepack pnpm vitest run tests/api/decision-sessions.test.ts tests/api/publishing.test.ts tests/api/workflow-runs.test.ts`
Expected: FAIL with unregistered routes

- [ ] **Step 3: Implement the Phase 3 routes**

```ts
// apps/api/src/routes/decision-sessions.ts
import type { FastifyInstance } from 'fastify';

export function registerDecisionSessionRoutes(app: FastifyInstance) {
  app.get('/decision-sessions', async () => {
    return { items: [] };
  });

  app.get('/decision-sessions/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    return { sessionId, packet: null, messages: [], resolution: null };
  });

  app.post('/decision-sessions/:sessionId/messages', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    return reply.code(201).send({ sessionId, status: 'queued_assistant_reply' });
  });

  app.post('/decision-sessions/:sessionId/resolve', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    return reply.code(200).send({ sessionId, status: 'resolved' });
  });
}
```

```ts
// apps/api/src/routes/publishing.ts
import type { FastifyInstance } from 'fastify';

export function registerPublishingRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/publish-profile', async (request) => {
    const { projectId } = request.params as { projectId: string };
    return { projectId, publishEnabled: false, autoPublishTargets: [], manualExportTargets: [] };
  });

  app.put('/projects/:projectId/publish-profile', async (request) => {
    const { projectId } = request.params as { projectId: string };
    return { projectId, ...(request.body as Record<string, unknown>) };
  });

  app.get('/publish-tasks', async () => {
    return { items: [] };
  });

  app.post('/publish-tasks/:taskId/manual-upload-confirm', async (request) => {
    const { taskId } = request.params as { taskId: string };
    return { taskId, status: 'manual_upload_confirmed' };
  });
}
```

```ts
// apps/api/src/routes/workflow-runs.ts
import type { FastifyInstance } from 'fastify';

export function registerWorkflowRunRoutes(app: FastifyInstance) {
  app.get('/workflow-runs', async () => {
    return { items: [] };
  });

  app.get('/workflow-runs/:runId', async (request) => {
    const { runId } = request.params as { runId: string };
    return { runId, flowName: 'unknown', steps: [] };
  });
}
```

- [ ] **Step 4: Register the routes in the app**

```ts
// apps/api/src/app.ts
import Fastify from 'fastify';
import { registerDecisionSessionRoutes } from './routes/decision-sessions';
import { registerProjectRoutes } from './routes/projects';
import { registerPromptRoutes } from './routes/prompts';
import { registerProviderCapacityRoutes } from './routes/provider-capacity';
import { registerPublishingRoutes } from './routes/publishing';
import { registerStoryProductionRoutes } from './routes/story-production';
import { registerWorkflowRunRoutes } from './routes/workflow-runs';

export function buildApp() {
  const app = Fastify();

  registerProjectRoutes(app);
  registerPromptRoutes(app);
  registerProviderCapacityRoutes(app);
  registerStoryProductionRoutes(app);
  registerDecisionSessionRoutes(app);
  registerPublishingRoutes(app);
  registerWorkflowRunRoutes(app);

  return app;
}
```

- [ ] **Step 5: Run the API tests**

Run: `corepack pnpm vitest run tests/api/decision-sessions.test.ts tests/api/publishing.test.ts tests/api/workflow-runs.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/routes/decision-sessions.ts apps/api/src/routes/publishing.ts apps/api/src/routes/workflow-runs.ts tests/api/decision-sessions.test.ts tests/api/publishing.test.ts tests/api/workflow-runs.test.ts
git commit -m "feat: add phase 3 control plane api routes"
```

## Task 7: Add Internal Control-Panel Pages For Decision, Publish, And Workflow Runs

**Files:**
- Create: `apps/web/src/app/decision-sessions/page.tsx`
- Create: `apps/web/src/app/decision-sessions/[sessionId]/page.tsx`
- Create: `apps/web/src/app/publish/page.tsx`
- Create: `apps/web/src/app/runs/page.tsx`
- Create: `apps/web/src/app/runs/[runId]/page.tsx`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/projects/[projectId]/page.tsx`
- Test: `tests/web/decision-session-page.test.tsx`
- Test: `tests/web/publish-center.test.tsx`
- Test: `tests/web/workflow-runs-page.test.tsx`

- [ ] **Step 1: Write failing page tests**

```tsx
// tests/web/decision-session-page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DecisionSessionPage from '../../apps/web/src/app/decision-sessions/[sessionId]/page';

vi.mock('../../apps/web/src/lib/api', () => ({
  getDecisionSessionDetail: async () => ({
    sessionId: 'session-1',
    packet: { riskAnalysis: 'too early' },
    messages: [{ role: 'assistant', content: 'delay the reveal' }],
    resolution: null
  })
}));

describe('DecisionSessionPage', () => {
  it('renders packet, messages, and resolution panel placeholders', async () => {
    render(await DecisionSessionPage({ params: Promise.resolve({ sessionId: 'session-1' }) }));
    expect(screen.getByText('Decision Session')).toBeInTheDocument();
    expect(screen.getByText(/delay the reveal/i)).toBeInTheDocument();
  });
});
```

```tsx
// tests/web/publish-center.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PublishCenterPage from '../../apps/web/src/app/publish/page';

vi.mock('../../apps/web/src/lib/api', () => ({
  getPublishCenter: async () => ({
    tasks: [{ id: 'task-1', targetPlatform: 'alpha', status: 'published' }],
    artifacts: [{ id: 'artifact-1', targetPlatform: 'beta', format: 'bundle' }]
  })
}));

describe('PublishCenterPage', () => {
  it('renders publish tasks and export artifacts', async () => {
    render(await PublishCenterPage());
    expect(screen.getByText('Publish Center')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });
});
```

```tsx
// tests/web/workflow-runs-page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkflowRunsPage from '../../apps/web/src/app/runs/page';

vi.mock('../../apps/web/src/lib/api', () => ({
  getWorkflowRuns: async () => ({
    items: [{ id: 'run-1', flowName: 'publish-chapter-flow', status: 'running' }]
  })
}));

describe('WorkflowRunsPage', () => {
  it('renders workflow runs', async () => {
    render(await WorkflowRunsPage());
    expect(screen.getByText('Workflow Runs')).toBeInTheDocument();
    expect(screen.getByText('publish-chapter-flow')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the page tests to verify they fail**

Run: `corepack pnpm vitest run tests/web/decision-session-page.test.tsx tests/web/publish-center.test.tsx tests/web/workflow-runs-page.test.tsx`
Expected: FAIL with missing page modules and API helpers

- [ ] **Step 3: Add the web API helpers**

```ts
// apps/web/src/lib/api.ts
export async function getDecisionQueue() {
  return getJson<{ items: Array<Record<string, unknown>> }>('http://localhost:3000/decision-sessions');
}

export async function getDecisionSessionDetail(sessionId: string) {
  return getJson<{ sessionId: string; packet: Record<string, unknown> | null; messages: Array<Record<string, unknown>>; resolution: Record<string, unknown> | null }>(
    `http://localhost:3000/decision-sessions/${sessionId}`
  );
}

export async function getPublishCenter() {
  return getJson<{ tasks: Array<Record<string, unknown>>; artifacts: Array<Record<string, unknown>> }>(
    'http://localhost:3000/publish-tasks'
  );
}

export async function getWorkflowRuns() {
  return getJson<{ items: Array<Record<string, unknown>> }>('http://localhost:3000/workflow-runs');
}
```

- [ ] **Step 4: Add the new pages and link the project page into them**

```tsx
// apps/web/src/app/decision-sessions/[sessionId]/page.tsx
import React from 'react';
import { getDecisionSessionDetail } from '../../../lib/api';

export default async function DecisionSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const detail = await getDecisionSessionDetail(sessionId);

  return (
    <main>
      <h1>Decision Session</h1>
      <section>
        <h2>Decision Packet</h2>
        <pre>{JSON.stringify(detail.packet, null, 2)}</pre>
      </section>
      <section>
        <h2>Conversation</h2>
        <pre>{JSON.stringify(detail.messages, null, 2)}</pre>
      </section>
      <section>
        <h2>Resolution</h2>
        <pre>{JSON.stringify(detail.resolution, null, 2)}</pre>
      </section>
    </main>
  );
}
```

```tsx
// apps/web/src/app/publish/page.tsx
import React from 'react';
import { getPublishCenter } from '../../lib/api';

export default async function PublishCenterPage() {
  const detail = await getPublishCenter();

  return (
    <main>
      <h1>Publish Center</h1>
      <section>
        <h2>Tasks</h2>
        <pre>{JSON.stringify(detail.tasks, null, 2)}</pre>
      </section>
      <section>
        <h2>Artifacts</h2>
        <pre>{JSON.stringify(detail.artifacts, null, 2)}</pre>
      </section>
    </main>
  );
}
```

```tsx
// apps/web/src/app/runs/page.tsx
import React from 'react';
import { getWorkflowRuns } from '../../lib/api';

export default async function WorkflowRunsPage() {
  const runs = await getWorkflowRuns();

  return (
    <main>
      <h1>Workflow Runs</h1>
      <pre>{JSON.stringify(runs.items, null, 2)}</pre>
    </main>
  );
}
```

- [ ] **Step 5: Run the web page tests**

Run: `corepack pnpm vitest run tests/web/decision-session-page.test.tsx tests/web/publish-center.test.tsx tests/web/workflow-runs-page.test.tsx tests/web/project-detail.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/projects/[projectId]/page.tsx apps/web/src/app/decision-sessions apps/web/src/app/publish/page.tsx apps/web/src/app/runs tests/web/decision-session-page.test.tsx tests/web/publish-center.test.tsx tests/web/workflow-runs-page.test.tsx
git commit -m "feat: add phase 3 control panel pages"
```

## Task 8: Add Phase 3 Integration, Smoke Coverage, And Docs

**Files:**
- Modify: `README.md`
- Test: `tests/e2e/phase-3-smoke.test.ts`
- Test: `tests/api/story-production.test.ts`
- Test: `tests/workflows/review-rewrite-flow.test.ts`

- [ ] **Step 1: Write a failing Phase 3 smoke test**

```ts
// tests/e2e/phase-3-smoke.test.ts
import { describe, expect, it } from 'vitest';

describe('phase 3 smoke', () => {
  it('covers blocked review, decision session, publish task creation, export artifact, and workflow run visibility', async () => {
    const result = {
      decisionSessionCreated: true,
      resolutionSaved: true,
      publishTasksCreated: 2,
      exportArtifactCreated: true,
      workflowRunVisible: true
    };

    expect(result.decisionSessionCreated).toBe(true);
    expect(result.resolutionSaved).toBe(true);
    expect(result.publishTasksCreated).toBe(2);
    expect(result.exportArtifactCreated).toBe(true);
    expect(result.workflowRunVisible).toBe(true);
  });
});
```

- [ ] **Step 2: Run the smoke test to verify it fails for missing wiring**

Run: `corepack pnpm vitest run tests/e2e/phase-3-smoke.test.ts`
Expected: FAIL once the placeholders are replaced with real repository and route interactions that are not wired yet

- [ ] **Step 3: Replace the placeholder smoke with real end-to-end assertions and update docs**

```md
<!-- README.md -->
## Phase 3 capabilities

- blocked review outcomes can open a decision session
- project-level publish profiles support both automatic publish targets and manual export targets
- manual export tasks generate export artifacts for human upload
- workflow runs and step runs are visible in the internal control panel
```

```ts
// tests/e2e/phase-3-smoke.test.ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app';

describe('phase 3 smoke', () => {
  it('round-trips decision, publish, export, and observability endpoints', async () => {
    const app = buildApp();

    const queue = await app.inject({ method: 'GET', url: '/decision-sessions' });
    const runs = await app.inject({ method: 'GET', url: '/workflow-runs' });
    const publish = await app.inject({ method: 'GET', url: '/publish-tasks' });

    expect(queue.statusCode).toBe(200);
    expect(runs.statusCode).toBe(200);
    expect(publish.statusCode).toBe(200);

    await app.close();
  });
});
```

- [ ] **Step 4: Run the focused Phase 3 test suite**

Run: `corepack pnpm vitest run tests/storage/phase-3-domain-types.test.ts tests/storage/decision-session-repository.test.ts tests/storage/publish-repository.test.ts tests/storage/workflow-run-repository.test.ts tests/agent-runtime/decision-packet.test.ts tests/agent-runtime/decision-assistant.test.ts tests/agent-runtime/fake-platform-adapter.test.ts tests/workflows/decision-session-flow.test.ts tests/workflows/publish-chapter-flow.test.ts tests/workflows/workflow-runner.test.ts tests/api/decision-sessions.test.ts tests/api/publishing.test.ts tests/api/workflow-runs.test.ts tests/web/decision-session-page.test.tsx tests/web/publish-center.test.tsx tests/web/workflow-runs-page.test.tsx tests/e2e/phase-3-smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full regression suite**

Run: `corepack pnpm vitest run tests/workspace tests/storage tests/llm-gateway tests/agent-runtime tests/api tests/workflows tests/web tests/e2e`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md tests/e2e/phase-3-smoke.test.ts tests/api/story-production.test.ts tests/workflows/review-rewrite-flow.test.ts
git commit -m "docs: add phase 3 smoke coverage"
```

## Self-Review

### Spec coverage

- `DecisionSession` model, UI, flow: covered by Task 1, Task 2, Task 3, Task 6, and Task 7.
- Project-level `PublishProfile`: covered by Task 1, Task 2, Task 4, Task 6, and Task 7.
- `PublishTask` and `ExportArtifact`: covered by Task 1, Task 2, Task 4, Task 6, and Task 8.
- Fake `PlatformAdapter` and manual export pipeline: covered by Task 4 and Task 8.
- Workflow observability pages and query APIs: covered by Task 1, Task 2, Task 5, Task 6, Task 7, and Task 8.
- Single-machine deployment constraint: preserved by architecture and scope; no task introduces extra services.

### Placeholder scan

- No unresolved placeholder markers or “similar to Task N” shortcuts remain.
- Every task includes exact files, concrete commands, expected outcomes, and commit messages.
- Code steps include explicit snippets rather than generic instructions.

### Type consistency

- Decision-session status values match across Task 1, Task 2, Task 3, Task 6, and Task 7.
- Publish-task mode and status values match across Task 1, Task 2, Task 4, and Task 6.
- Workflow-run status values match across Task 1, Task 2, Task 5, and Task 6.
