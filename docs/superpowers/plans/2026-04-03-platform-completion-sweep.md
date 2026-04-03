# Platform Completion Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the remaining intentional placeholders across API, storage, worker, and web so every feature except adapter auto-upload uses real persistence and real end-to-end flows.

**Architecture:** Keep the existing package boundaries intact: repositories own persistence, API routes translate request/response shapes, worker owns workflow dispatch, and web consumes only API helpers. Finish the system by replacing echo/stub routes with repository-backed implementations, then wire UI forms to the real APIs and lock the behavior down with focused plus smoke tests.

**Tech Stack:** Fastify, Next.js App Router, Prisma repositories, Vitest, existing workflow/agent-runtime packages

---

### Task 1: Finish Real Persistence For Core CRUD Surfaces

**Files:**
- Modify: `packages/storage/src/repositories/project-repository.ts`
- Modify: `packages/storage/src/repositories/prompt-repository.ts`
- Create: `packages/storage/src/repositories/provider-capacity-repository.ts`
- Modify: `apps/api/src/routes/projects.ts`
- Modify: `apps/api/src/routes/prompts.ts`
- Modify: `apps/api/src/routes/provider-capacity.ts`
- Modify: `tests/storage/project-repository.test.ts`
- Modify: `tests/storage/prompt-repository.test.ts`
- Create: `tests/storage/provider-capacity-repository.test.ts`
- Modify: `tests/api/projects.test.ts`
- Modify: `tests/api/prompts.test.ts`
- Modify: `tests/api/provider-capacity.test.ts`
- Modify: `tests/e2e/phase-1-smoke.test.ts`

- [ ] **Step 1: Write the failing storage/API tests**

```ts
it('persists a created project through the repository-backed route', async () => {
  expect(response.statusCode).toBe(201);
  expect(createMock).toHaveBeenCalledTimes(1);
});

it('persists prompt configs instead of echoing transient objects', async () => {
  expect(prisma.promptConfig.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ agentName: 'outline-agent' })
  });
});

it('stores provider capacity registrations and returns the saved record', async () => {
  expect(prisma.providerCapacityRecord.create).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `corepack pnpm vitest run tests/storage/project-repository.test.ts tests/storage/prompt-repository.test.ts tests/storage/provider-capacity-repository.test.ts tests/api/projects.test.ts tests/api/prompts.test.ts tests/api/provider-capacity.test.ts tests/e2e/phase-1-smoke.test.ts`

Expected: FAIL because project/prompt/provider-capacity routes still bypass repository persistence or the new repository file does not exist yet.

- [ ] **Step 3: Implement the repositories and route wiring**

```ts
export class ProviderCapacityRepository {
  async create(capacity: ProviderCapacity) {
    return prisma.providerCapacityRecord.create({
      data: capacity
    });
  }
}

app.post('/prompts', async (request, reply) => {
  const payload = parsePromptPayload(request.body);
  if (!payload) {
    return reply.code(400).send({ message: 'Invalid prompt payload' });
  }

  const repository = await getPromptRepository();
  const prompt = await repository.create({
    ...payload,
    id: crypto.randomUUID()
  });

  return reply.code(201).send(prompt);
});
```

- [ ] **Step 4: Run the focused tests to verify GREEN**

Run: `corepack pnpm vitest run tests/storage/project-repository.test.ts tests/storage/prompt-repository.test.ts tests/storage/provider-capacity-repository.test.ts tests/api/projects.test.ts tests/api/prompts.test.ts tests/api/provider-capacity.test.ts tests/e2e/phase-1-smoke.test.ts`

Expected: PASS with the new repository and route tests green.

### Task 2: Replace Story-Production Queue Stubs With Real Workflow-Run Creation

**Files:**
- Modify: `packages/storage/src/repositories/workflow-run-repository.ts`
- Modify: `apps/api/src/routes/story-production.ts`
- Modify: `tests/storage/workflow-run-repository.test.ts`
- Modify: `tests/api/story-production.test.ts`
- Modify: `tests/e2e/phase-2-smoke.test.ts`

- [ ] **Step 1: Write the failing tests for real workflow-run creation**

```ts
it('creates a queued workflow run when outline generation is requested', async () => {
  expect(createRunMock).toHaveBeenCalledWith({
    flowName: 'generate-outline-flow',
    projectId: 'project-1',
    chapterNumber: null
  });
  expect(response.json()).toMatchObject({
    projectId: 'project-1',
    workflowRunId: 'workflow-run-1',
    status: 'queued'
  });
});
```

- [ ] **Step 2: Run the story-production tests to verify RED**

Run: `corepack pnpm vitest run tests/storage/workflow-run-repository.test.ts tests/api/story-production.test.ts tests/e2e/phase-2-smoke.test.ts`

Expected: FAIL because the routes only return `enqueueWorkflow(...)` metadata and do not persist workflow runs.

- [ ] **Step 3: Implement repository-backed queue responses**

```ts
const repository = await getWorkflowRunRepository();
const workflowRun = await repository.createRun({
  flowName: flow.name,
  projectId,
  chapterNumber
});

return reply.code(202).send({
  projectId,
  workflowRunId: workflowRun.id,
  ...enqueueWorkflow(flow)
});
```

- [ ] **Step 4: Run the story-production tests to verify GREEN**

Run: `corepack pnpm vitest run tests/storage/workflow-run-repository.test.ts tests/api/story-production.test.ts tests/e2e/phase-2-smoke.test.ts`

Expected: PASS, with each story-production trigger returning a real `workflowRunId`.

### Task 3: Close The Decision Session UI Loop

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/decision-sessions/[sessionId]/page.tsx`
- Modify: `tests/web/decision-session-page.test.tsx`
- Modify: `tests/api/decision-sessions.test.ts`
- Modify: `tests/api/decision-session-resolution.test.ts`
- Modify: `tests/e2e/phase-4-decision-session-smoke.test.ts`

- [ ] **Step 1: Write the failing UI tests for message/draft/resolve forms**

```tsx
expect(html).toContain('Send Message');
expect(html).toContain('Generate Draft Resolution');
expect(html).toContain('Confirm Resolution');
expect(html).toContain('/decision-sessions/session-123/messages');
expect(html).toContain('/decision-sessions/session-123/generate-resolution');
expect(html).toContain('/decision-sessions/session-123/resolve');
```

- [ ] **Step 2: Run the decision-session web and smoke tests to verify RED**

Run: `corepack pnpm vitest run tests/web/decision-session-page.test.tsx tests/api/decision-sessions.test.ts tests/api/decision-session-resolution.test.ts tests/e2e/phase-4-decision-session-smoke.test.ts`

Expected: FAIL because the page still renders status JSON only and exposes no interactive form actions.

- [ ] **Step 3: Add API helper calls and plain HTML form controls**

```tsx
<form action={`${API_BASE_URL}/decision-sessions/${detail.sessionId}/messages`} method="POST">
  <textarea name="content" />
  <button type="submit">Send Message</button>
</form>

<form action={`${API_BASE_URL}/decision-sessions/${detail.sessionId}/generate-resolution`} method="POST">
  <input name="resolutionType" defaultValue="replan_window" />
  <button type="submit">Generate Draft Resolution</button>
</form>
```

```ts
export async function createDecisionMessage(sessionId: string, payload: { content: string }) {
  return postJson(`${API_BASE_URL}/decision-sessions/${sessionId}/messages`, payload);
}
```

- [ ] **Step 4: Run the decision-session web and smoke tests to verify GREEN**

Run: `corepack pnpm vitest run tests/web/decision-session-page.test.tsx tests/api/decision-sessions.test.ts tests/api/decision-session-resolution.test.ts tests/e2e/phase-4-decision-session-smoke.test.ts`

Expected: PASS with the page exposing complete message/draft/resolve controls over the real API routes.

### Task 4: Full-System Regression And Documentation Cleanup

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-04-03-platform-completion-sweep.md`
- Verify existing touched files from Tasks 1-3 plus already-completed export/publish/workflow surfaces

- [ ] **Step 1: Update the README to reflect the new non-placeholder behavior**

```md
- projects, prompt configs, and provider capacity registrations persist through storage-backed APIs
- story production requests create real workflow-run records
- decision session detail pages support message submission, draft generation, and resolution confirmation
- automatic platform upload remains intentionally unsupported; manual export remains the supported path
```

- [ ] **Step 2: Run the broad regression suite**

Run: `corepack pnpm vitest run tests/api tests/web tests/worker tests/storage tests/e2e tests/workflows tests/agent-runtime tests/llm-gateway`

Expected: PASS across the entire repository.

- [ ] **Step 3: Do a final placeholder sweep**

Run: `rg -n "placeholder|flowName: 'unknown'|task-1|artifact-1|run-1|echo|temporary|TODO" apps packages README.md tests -g'*.ts' -g'*.tsx' -g'*.md'`

Expected: Only test fixture strings remain, plus the intentional auto-upload placeholder references.

- [ ] **Step 4: Mark the intentional remaining gap explicitly in docs**

```md
Adapter auto-upload remains a placeholder by design. Publish tasks may still target `manual_export`; no live external publishing adapter is implemented in this phase.
```
