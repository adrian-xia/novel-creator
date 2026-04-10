# AI Novel Generator Human Gates And Outline/Volume Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a reusable human-gate model, pause workflows for outline/volume confirmation, and let the single-user control panel confirm or cancel those gates with recommended options plus free-text notes.

**Architecture:** Reuse the existing `decision-session` storage/API surface as the transitional transport boundary, but generalize it into a typed human-gate abstraction. Outline and volume workflows will persist their generated artifacts, request a gate, and stop the current `WorkflowRun` in a `waiting_for_human_gate` state. Confirming a gate will create the follow-up workflow run rather than mutating the old run back to life.

**Tech Stack:** TypeScript, Prisma, Fastify, Next.js App Router, Vitest, existing `packages/workflows`, `packages/storage`, `packages/domain`, and `apps/web`

---

## File Structure

- `packages/domain/src/human-gate.ts`
  - New domain model for reusable gate sessions, recommendation options, and confirmation payloads.
- `packages/domain/src/workflow-observability.ts`
  - Add workflow status support for human-gate pauses.
- `packages/domain/src/index.ts`
  - Export the new human-gate types.
- `packages/storage/prisma/schema.prisma`
  - Extend `DecisionSessionRecord` so it can hold gate type, recommendation options, selected option, and free-text user notes.
- `packages/storage/src/repositories/decision-session-repository.ts`
  - Add generic gate-session creation, listing, confirmation, and cancellation helpers.
- `packages/storage/src/repositories/workflow-run-repository.ts`
  - Add a repository method for marking runs as `waiting_for_human_gate`.
- `packages/workflows/src/workflow-runner.ts`
  - Teach the runner to stop cleanly when a step requests a human gate.
- `packages/workflows/src/outline-volume-executors.ts`
  - Create gate sessions after persisting outline/volume outputs and raise a pause signal.
- `packages/workflows/src/human-gate.ts`
  - New workflow-level pause signal and helper for gate requests.
- `apps/api/src/routes/decision-sessions.ts`
  - Expose gate detail, confirm, and cancel routes using the existing URL namespace.
- `apps/web/src/lib/api.ts`
  - Add typed client calls for gate confirmation and cancellation.
- `apps/web/src/app/decision-sessions/page.tsx`
  - Show queue items as human gates with gate type and recommendation metadata.
- `apps/web/src/app/decision-sessions/[sessionId]/page.tsx`
  - Render recommended options, free-text notes, and confirm/cancel controls.
- `tests/storage/phase-4-decision-types.test.ts`
  - Add domain type coverage for the human-gate model.
- `tests/storage/decision-session-repository.test.ts`
  - Add repository tests for gate creation and confirmation.
- `tests/storage/workflow-run-repository.test.ts`
  - Add paused workflow status coverage.
- `tests/workflows/workflow-runner.test.ts`
  - Add a runner test for pausing on a gate request.
- `tests/workflows/outline-volume-executors.test.ts`
  - Add outline/volume gate-creation tests.
- `tests/api/decision-sessions.test.ts`
  - Add confirm/cancel route coverage.
- `tests/web/decision-session-page.test.tsx`
  - Add UI coverage for recommendation options and confirmation controls.
- `tests/web/decision-queue-page.test.tsx`
  - Add queue coverage for gate type and recommendation status.

### Task 1: Add The Reusable Human-Gate Domain Model

**Files:**
- Create: `packages/domain/src/human-gate.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `tests/storage/phase-4-decision-types.test.ts`

- [x] **Step 1: Write the failing domain-type test**

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type {
  HumanGateOption,
  HumanGateSession,
  HumanGateType
} from '@novel-creator/domain';

describe('phase 4 decision types', () => {
  it('exposes reusable human gate types for confirmation workflows', () => {
    expectTypeOf<HumanGateType>().toEqualTypeOf<
      | 'outline_confirmation'
      | 'volume_confirmation'
      | 'blocked_decision'
      | 'resume_confirmation'
    >();

    expectTypeOf<HumanGateOption>().toMatchTypeOf<{
      optionId: string;
      title: string;
      strategy: 'recommended' | 'alternative' | 'custom_seed';
      rationale: string;
      impactSummary: string;
      patch: Record<string, unknown>;
    }>();

    expectTypeOf<HumanGateSession>().toMatchTypeOf<{
      gateType: HumanGateType;
      recommendedOptionId: string | null;
      options: HumanGateOption[];
      selectedOptionId: string | null;
      humanNotes: string | null;
    }>();
  });
});
```

- [x] **Step 2: Run the type test to verify it fails**

Run: `pnpm vitest run tests/storage/phase-4-decision-types.test.ts`
Expected: FAIL because `HumanGateType`, `HumanGateOption`, and `HumanGateSession` do not exist in the domain package.

- [x] **Step 3: Add the human-gate domain file and export it**

```ts
// packages/domain/src/human-gate.ts
export type HumanGateType =
  | 'outline_confirmation'
  | 'volume_confirmation'
  | 'blocked_decision'
  | 'resume_confirmation';

export interface HumanGateOption {
  optionId: string;
  title: string;
  strategy: 'recommended' | 'alternative' | 'custom_seed';
  rationale: string;
  impactSummary: string;
  patch: Record<string, unknown>;
}

export interface HumanGateSession {
  sessionId: string;
  projectId: string;
  chapterNumber: number | null;
  gateType: HumanGateType;
  status: 'open' | 'awaiting_confirmation' | 'confirmed' | 'cancelled';
  contextSnapshot: Record<string, unknown>;
  options: HumanGateOption[];
  recommendedOptionId: string | null;
  selectedOptionId: string | null;
  humanNotes: string | null;
}
```

```ts
// packages/domain/src/index.ts
export * from './human-gate';
```

- [x] **Step 4: Run the type test to verify it passes**

Run: `pnpm vitest run tests/storage/phase-4-decision-types.test.ts`
Expected: PASS with the new domain types exported from `@novel-creator/domain`.

- [x] **Step 5: Commit**

```bash
git add packages/domain/src/human-gate.ts \
  packages/domain/src/index.ts \
  tests/storage/phase-4-decision-types.test.ts
git commit -m "feat: add reusable human gate domain types"
```

### Task 2: Persist Gate Metadata And Paused Workflow Status

**Files:**
- Modify: `packages/storage/prisma/schema.prisma`
- Modify: `packages/domain/src/workflow-observability.ts`
- Modify: `packages/storage/src/repositories/decision-session-repository.ts`
- Modify: `packages/storage/src/repositories/workflow-run-repository.ts`
- Modify: `tests/storage/decision-session-repository.test.ts`
- Modify: `tests/storage/workflow-run-repository.test.ts`

- [x] **Step 1: Write the failing repository tests**

```ts
it('creates a human gate session with recommendation options and gate metadata', async () => {
  await repository.createHumanGateSession({
    projectId: 'project-1',
    chapterNumber: null,
    gateType: 'outline_confirmation',
    triggerReason: 'outline_ready_for_confirmation',
    contextSnapshot: { outlineVersion: 1 },
    options: [
      {
        optionId: 'accept-outline',
        title: '直接采用',
        strategy: 'recommended',
        rationale: '结构完整，可直接推进。',
        impactSummary: '立即进入卷规划。',
        patch: { action: 'accept' }
      }
    ],
    recommendedOptionId: 'accept-outline'
  });

  expect(prisma.decisionSessionRecord.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      gateType: 'outline_confirmation',
      options: expect.any(Array),
      recommendedOptionId: 'accept-outline',
      selectedOptionId: null,
      humanNotes: null
    })
  });
});
```

```ts
it('marks a workflow run as waiting_for_human_gate with the gate session id', async () => {
  await repository.markRunWaitingForHumanGate('workflow-run-1', 'session-123');

  expect(prisma.workflowRunRecord.update).toHaveBeenCalledWith({
    where: { id: 'workflow-run-1' },
    data: {
      status: 'waiting_for_human_gate',
      errorMessage: 'Waiting for human gate session session-123'
    }
  });
});
```

- [x] **Step 2: Run the repository tests to verify they fail**

Run: `pnpm vitest run tests/storage/decision-session-repository.test.ts tests/storage/workflow-run-repository.test.ts`
Expected: FAIL because the schema and repositories do not support gate metadata or paused workflow status.

- [x] **Step 3: Extend the schema and repository methods**

```prisma
// packages/storage/prisma/schema.prisma
model DecisionSessionRecord {
  id                    String   @id @default(uuid())
  projectId             String
  chapterNumber         Int?
  gateType              String   @default("blocked_decision")
  triggerReason         String?
  sourceReviewOutcomeId String?
  status                String
  packet                Json
  contextSnapshot       Json
  options               Json     @default("[]")
  recommendedOptionId   String?
  selectedOptionId      String?
  humanNotes            String?
  currentDraftResolution Json?
  resolvedAt            DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  project               NovelProject @relation(fields: [projectId], references: [id])
  messages              DecisionMessageRecord[]
  resolution            DecisionResolutionRecord?
}
```

```ts
// packages/domain/src/workflow-observability.ts
export interface WorkflowRun {
  id: string;
  flowName: string;
  projectId: string;
  chapterNumber: number | null;
  status: 'queued' | 'running' | 'waiting_for_human_gate' | 'succeeded' | 'failed';
  errorMessage?: string | null;
}
```

```ts
// packages/storage/src/repositories/decision-session-repository.ts
async createHumanGateSession(input: {
  projectId: string;
  chapterNumber: number | null;
  gateType: string;
  triggerReason: string | null;
  contextSnapshot: Record<string, unknown>;
  options: Array<Record<string, unknown>>;
  recommendedOptionId: string | null;
}) {
  return prisma.decisionSessionRecord.create({
    data: {
      projectId: input.projectId,
      chapterNumber: input.chapterNumber,
      gateType: input.gateType,
      triggerReason: input.triggerReason,
      status: 'open',
      packet: input.contextSnapshot,
      contextSnapshot: input.contextSnapshot,
      options: input.options,
      recommendedOptionId: input.recommendedOptionId,
      selectedOptionId: null,
      humanNotes: null,
      sourceReviewOutcomeId: null,
      currentDraftResolution: null
    }
  });
}

async confirmHumanGate(sessionId: string, input: {
  selectedOptionId: string;
  humanNotes: string | null;
}) {
  return prisma.decisionSessionRecord.update({
    where: { id: sessionId },
    data: {
      status: 'resolved',
      selectedOptionId: input.selectedOptionId,
      humanNotes: input.humanNotes,
      resolvedAt: new Date()
    }
  });
}
```

```ts
// packages/storage/src/repositories/workflow-run-repository.ts
async markRunWaitingForHumanGate(workflowRunId: string, sessionId: string) {
  return prisma.workflowRunRecord.update({
    where: { id: workflowRunId },
    data: {
      status: 'waiting_for_human_gate',
      errorMessage: `Waiting for human gate session ${sessionId}`
    }
  });
}
```

- [x] **Step 4: Run the repository tests to verify they pass**

Run: `pnpm vitest run tests/storage/decision-session-repository.test.ts tests/storage/workflow-run-repository.test.ts`
Expected: PASS with gate metadata persisted and workflow runs able to stop in a human-gate state.

- [x] **Step 5: Commit**

```bash
git add packages/storage/prisma/schema.prisma \
  packages/domain/src/workflow-observability.ts \
  packages/storage/src/repositories/decision-session-repository.ts \
  packages/storage/src/repositories/workflow-run-repository.ts \
  tests/storage/decision-session-repository.test.ts \
  tests/storage/workflow-run-repository.test.ts
git commit -m "feat: persist human gate sessions and paused workflow runs"
```

### Task 3: Pause Outline And Volume Workflows For Confirmation

**Files:**
- Create: `packages/workflows/src/human-gate.ts`
- Modify: `packages/workflows/src/workflow-runner.ts`
- Modify: `packages/workflows/src/outline-volume-executors.ts`
- Modify: `tests/workflows/workflow-runner.test.ts`
- Modify: `tests/workflows/outline-volume-executors.test.ts`

- [ ] **Step 1: Write the failing workflow tests**

```ts
it('marks the workflow run as waiting_for_human_gate when a step requests confirmation', async () => {
  createRun.mockResolvedValue({ id: 'workflow-run-4' });

  const { runInstrumentedWorkflow } = await import('../../packages/workflows/src/workflow-runner');
  const { requestHumanGate } = await import('../../packages/workflows/src/human-gate');

  await expect(
    runInstrumentedWorkflow({
      flow: {
        name: 'generate-outline-flow',
        buildInitialContext: (payload) => payload,
        steps: [
          {
            name: 'pause-for-outline-confirmation',
            run: async () => requestHumanGate('session-123')
          }
        ]
      },
      payload: { projectId: 'project-1', chapterNumber: null },
      deps: {}
    })
  ).resolves.toEqual(expect.objectContaining({ waitingForHumanGate: 'session-123' }));

  expect(markRunWaitingForHumanGate).toHaveBeenCalledWith('workflow-run-4', 'session-123');
});
```

```ts
it('creates an outline confirmation gate after persisting outline output', async () => {
  await expect(
    persistOutlineStep(
      {
        projectId: 'project-1',
        chapterNumber: null,
        project: { id: 'project-1', premise: '测试', genre: '玄幻', storyState: null },
        outline: { title: '总纲' },
        storyBible: '世界观'
      },
      deps
    )
  ).rejects.toMatchObject({
    name: 'HumanGateRequestedError',
    sessionId: 'session-outline-1'
  });

  expect(createHumanGateSession).toHaveBeenCalledWith(
    expect.objectContaining({
      gateType: 'outline_confirmation'
    })
  );
});
```

- [ ] **Step 2: Run the workflow tests to verify they fail**

Run: `pnpm vitest run tests/workflows/workflow-runner.test.ts tests/workflows/outline-volume-executors.test.ts`
Expected: FAIL because the workflow runner cannot pause for gates and the outline/volume executors do not create confirmation sessions.

- [ ] **Step 3: Add the pause signal and create gates from the outline/volume executors**

```ts
// packages/workflows/src/human-gate.ts
export class HumanGateRequestedError extends Error {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Human gate requested: ${sessionId}`);
    this.name = 'HumanGateRequestedError';
    this.sessionId = sessionId;
  }
}

export function requestHumanGate(sessionId: string): never {
  throw new HumanGateRequestedError(sessionId);
}
```

```ts
// packages/workflows/src/workflow-runner.ts
import { HumanGateRequestedError } from './human-gate';

// inside the per-step try/catch
if (error instanceof HumanGateRequestedError) {
  await repository.markRunWaitingForHumanGate(run.id, error.sessionId);
  return {
    ...context,
    waitingForHumanGate: error.sessionId
  };
}
```

```ts
// packages/workflows/src/outline-volume-executors.ts
import { requestHumanGate } from './human-gate';

const session = await deps.decisionSessionRepository.createHumanGateSession({
  projectId: context.projectId,
  chapterNumber: null,
  gateType: 'outline_confirmation',
  triggerReason: 'outline_ready_for_confirmation',
  contextSnapshot: {
    outline: context.outline,
    storyBible: context.storyBible
  },
  options: buildOutlineGateOptions(context.outline, context.storyBible),
  recommendedOptionId: 'accept-outline'
});

requestHumanGate(session.id);
```

- [ ] **Step 4: Run the workflow tests to verify they pass**

Run: `pnpm vitest run tests/workflows/workflow-runner.test.ts tests/workflows/outline-volume-executors.test.ts`
Expected: PASS with outline and volume flows pausing cleanly after creating gate sessions.

- [ ] **Step 5: Commit**

```bash
git add packages/workflows/src/human-gate.ts \
  packages/workflows/src/workflow-runner.ts \
  packages/workflows/src/outline-volume-executors.ts \
  tests/workflows/workflow-runner.test.ts \
  tests/workflows/outline-volume-executors.test.ts
git commit -m "feat: pause outline and volume workflows for human confirmation"
```

### Task 4: Expose Gate Confirmation And Cancellation Through The API And UI

**Files:**
- Modify: `apps/api/src/routes/decision-sessions.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/decision-sessions/page.tsx`
- Modify: `apps/web/src/app/decision-sessions/[sessionId]/page.tsx`
- Modify: `tests/api/decision-sessions.test.ts`
- Modify: `tests/web/decision-session-page.test.tsx`
- Modify: `tests/web/decision-queue-page.test.tsx`

- [ ] **Step 1: Write the failing API and UI tests**

```ts
it('confirms a human gate with the selected option and free-text notes', async () => {
  confirmHumanGateMock.mockResolvedValue({
    id: 'session-123',
    status: 'resolved',
    selectedOptionId: 'accept-outline',
    humanNotes: '保留主线，先继续。'
  });

  const response = await app.inject({
    method: 'POST',
    url: '/decision-sessions/session-123/confirm',
    payload: {
      selectedOptionId: 'accept-outline',
      humanNotes: '保留主线，先继续。'
    }
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    sessionId: 'session-123',
    status: 'resolved',
    selectedOptionId: 'accept-outline'
  });
});
```

```tsx
expect(html).toContain('系统推荐');
expect(html).toContain('accept-outline');
expect(html).toContain('采用推荐方案');
expect(html).toContain('取消 Gate');
```

- [ ] **Step 2: Run the API and UI tests to verify they fail**

Run: `pnpm vitest run tests/api/decision-sessions.test.ts tests/web/decision-session-page.test.tsx tests/web/decision-queue-page.test.tsx`
Expected: FAIL because the routes and pages do not yet expose gate recommendation metadata or confirmation/cancellation actions.

- [ ] **Step 3: Add the confirm/cancel routes and render recommendation-first UI**

```ts
// apps/api/src/routes/decision-sessions.ts
app.post('/decision-sessions/:sessionId/confirm', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const body = request.body as {
    selectedOptionId?: string;
    humanNotes?: string | null;
  };

  if (typeof body.selectedOptionId !== 'string' || body.selectedOptionId.length === 0) {
    return reply.code(400).send({ message: 'Invalid gate confirmation payload' });
  }

  const repository = await getDecisionSessionRepository();
  const session = await repository.confirmHumanGate(sessionId, {
    selectedOptionId: body.selectedOptionId,
    humanNotes: typeof body.humanNotes === 'string' ? body.humanNotes : null
  });

  return reply.send({
    sessionId,
    status: session.status,
    selectedOptionId: session.selectedOptionId,
    humanNotes: session.humanNotes
  });
});

app.post('/decision-sessions/:sessionId/cancel', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  const repository = await getDecisionSessionRepository();
  const session = await repository.cancelSession(sessionId);

  return reply.send({
    sessionId,
    status: session.status
  });
});
```

```ts
// apps/web/src/lib/api.ts
export async function confirmHumanGate(
  sessionId: string,
  payload: { selectedOptionId: string; humanNotes: string | null }
) {
  return postJson(`${API_BASE_URL}/decision-sessions/${sessionId}/confirm`, payload);
}

export async function cancelHumanGate(sessionId: string) {
  return postJson(`${API_BASE_URL}/decision-sessions/${sessionId}/cancel`, {});
}
```

```tsx
// apps/web/src/app/decision-sessions/[sessionId]/page.tsx
<section>
  <h2>Recommended Options</h2>
  <ol>
    {detail.options.map((option) => (
      <li key={option.optionId}>
        <strong>{option.title}</strong>
        <div>{option.strategy === 'recommended' ? '系统推荐' : '备选方案'}</div>
        <p>{option.rationale}</p>
        <p>{option.impactSummary}</p>
      </li>
    ))}
  </ol>
</section>
```

- [ ] **Step 4: Run the API and UI tests to verify they pass**

Run: `pnpm vitest run tests/api/decision-sessions.test.ts tests/web/decision-session-page.test.tsx tests/web/decision-queue-page.test.tsx`
Expected: PASS with users able to view recommendation options and confirm or cancel gate sessions.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/decision-sessions.ts \
  apps/web/src/lib/api.ts \
  apps/web/src/app/decision-sessions/page.tsx \
  'apps/web/src/app/decision-sessions/[sessionId]/page.tsx' \
  tests/api/decision-sessions.test.ts \
  tests/web/decision-session-page.test.tsx \
  tests/web/decision-queue-page.test.tsx
git commit -m "feat: expose human gate confirmation controls"
```

### Task 5: Resume From Confirmed Outline And Volume Gates

**Files:**
- Modify: `apps/api/src/routes/decision-sessions.ts`
- Modify: `packages/workflows/src/enqueue.ts`
- Modify: `tests/api/decision-sessions.test.ts`
- Modify: `tests/e2e/phase-3-smoke.test.ts`

- [ ] **Step 1: Write the failing resume tests**

```ts
it('returns generate-volume work after confirming an outline gate', async () => {
  confirmHumanGateMock.mockResolvedValue({
    id: 'session-outline-1',
    gateType: 'outline_confirmation',
    projectId: 'project-1',
    chapterNumber: null,
    status: 'resolved',
    selectedOptionId: 'accept-outline',
    humanNotes: null
  });

  const response = await app.inject({
    method: 'POST',
    url: '/decision-sessions/session-outline-1/confirm',
    payload: { selectedOptionId: 'accept-outline', humanNotes: null }
  });

  expect(response.json()).toMatchObject({
    nextWork: {
      flowName: 'generate-volume-flow',
      status: 'queued'
    }
  });
});
```

- [ ] **Step 2: Run the resume tests to verify they fail**

Run: `pnpm vitest run tests/api/decision-sessions.test.ts tests/e2e/phase-3-smoke.test.ts`
Expected: FAIL because confirming a gate does not yet declare which workflow should run next.

- [ ] **Step 3: Return follow-up workflow metadata for confirmed outline and volume gates**

```ts
// apps/api/src/routes/decision-sessions.ts
function buildNextWork(session: {
  gateType?: string;
  projectId: string;
}) {
  if (session.gateType === 'outline_confirmation') {
    return enqueueWorkflow(generateVolumeFlow());
  }

  if (session.gateType === 'volume_confirmation') {
    return enqueueWorkflow(generateChapterFlow());
  }

  return null;
}

// inside the confirm route response
return reply.send({
  sessionId,
  status: session.status,
  selectedOptionId: session.selectedOptionId,
  humanNotes: session.humanNotes,
  nextWork: buildNextWork(session)
});
```

- [ ] **Step 4: Run the resume tests to verify they pass**

Run: `pnpm vitest run tests/api/decision-sessions.test.ts tests/e2e/phase-3-smoke.test.ts`
Expected: PASS with outline confirmation handing off to volume generation and volume confirmation handing off to chapter generation metadata.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/decision-sessions.ts \
  packages/workflows/src/enqueue.ts \
  tests/api/decision-sessions.test.ts \
  tests/e2e/phase-3-smoke.test.ts
git commit -m "feat: resume production chain from confirmed human gates"
```

## Self-Review

### Spec coverage

- Unified human-gate model: covered by Task 1 and Task 2
- Workflow pause/resume for outline and volume confirmation: covered by Task 3 and Task 5
- Recommendation options plus free-text notes in the UI/API: covered by Task 4
- Single-user confirmation and cancellation flow: covered by Task 4
- Reusing the current decision-session surface as the transitional gate transport: covered by Task 2, Task 4, and Task 5

### Placeholder scan

- No `TBD`, `TODO`, or “implement later” placeholders remain in task steps.
- Every code-changing step includes concrete code blocks.
- Every verification step includes an exact command and an expected outcome.

### Type consistency

- `HumanGateSession`, `gateType`, `recommendedOptionId`, `selectedOptionId`, and `humanNotes` use the same names across domain, storage, API, UI, and tests.
- Workflow pause status is consistently named `waiting_for_human_gate`.
- Confirmation route naming is consistently `POST /decision-sessions/:sessionId/confirm`.
