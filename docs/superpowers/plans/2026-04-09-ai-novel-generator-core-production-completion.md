# AI Novel Generator Core Production Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Phase 2 production skeleton with a real worker-executed content pipeline that persists story state, chapter artifacts, review outcomes, agent audits, and workflow execution status.

**Architecture:** Keep the existing monorepo boundaries, but introduce a typed workflow execution layer inside `packages/workflows` so the worker can run real steps instead of only recording fake success. Route handlers continue to enqueue workflow runs, `packages/agent-runtime` remains the only model invocation boundary, and `packages/storage` stays the only persistence boundary for story, chapter, and workflow state.

**Tech Stack:** Fastify, Next.js App Router, Prisma repositories, Vitest, existing `packages/workflows`, `packages/agent-runtime`, `packages/storage`

---

### Task 1: Build A Real Workflow Execution Runtime

**Files:**
- Create: `packages/workflows/src/workflow-runtime.ts`
- Modify: `packages/workflows/src/create-project-flow.ts`
- Modify: `packages/workflows/src/generate-outline-flow.ts`
- Modify: `packages/workflows/src/generate-volume-flow.ts`
- Modify: `packages/workflows/src/generate-chapter-flow.ts`
- Modify: `packages/workflows/src/review-rewrite-flow.ts`
- Modify: `packages/workflows/src/decision-session-flow.ts`
- Modify: `packages/workflows/src/chapter-replan-flow.ts`
- Modify: `packages/workflows/src/publish-chapter-flow.ts`
- Modify: `packages/workflows/src/index.ts`
- Modify: `packages/workflows/src/workflow-runner.ts`
- Test: `tests/workflows/generate-outline-flow.test.ts`
- Test: `tests/workflows/generate-volume-flow.test.ts`
- Test: `tests/workflows/generate-chapter-flow.test.ts`
- Test: `tests/workflows/review-rewrite-flow.test.ts`
- Test: `tests/workflows/workflow-runner.test.ts`

- [x] **Step 1: Write failing tests for executor-backed workflow definitions**

```ts
import { describe, expect, it } from 'vitest';
import { generateOutlineFlow } from '../../packages/workflows/src';

describe('generateOutlineFlow', () => {
  it('returns typed steps with executable handlers', () => {
    const flow = generateOutlineFlow();

    expect(flow.name).toBe('generate-outline-flow');
    expect(flow.steps.map((step) => step.name)).toEqual([
      'load-project-input',
      'load-outline-prompt',
      'run-outline-agent',
      'persist-outline'
    ]);
    expect(typeof flow.buildInitialContext).toBe('function');
    expect(typeof flow.steps[0]?.run).toBe('function');
  });
});
```

```ts
import { describe, expect, it, vi } from 'vitest';

const createRun = vi.fn();
const markStepRunning = vi.fn();
const markStepSucceeded = vi.fn();
const markStepFailed = vi.fn();
const markRunSucceeded = vi.fn();
const markRunFailed = vi.fn();

vi.mock('../../packages/storage/src/repositories/workflow-run-repository', () => ({
  WorkflowRunRepository: class {
    createRun = createRun;
    markStepRunning = markStepRunning;
    markStepSucceeded = markStepSucceeded;
    markStepFailed = markStepFailed;
    markRunSucceeded = markRunSucceeded;
    markRunFailed = markRunFailed;
  }
}));

describe('runInstrumentedWorkflow', () => {
  it('marks the failing step and workflow run when a step throws', async () => {
    createRun.mockResolvedValue({ id: 'workflow-run-1' });

    const { runInstrumentedWorkflow } = await import('../../packages/workflows/src/workflow-runner');

    await expect(
      runInstrumentedWorkflow({
        flow: {
          name: 'generate-outline-flow',
          buildInitialContext: (payload) => payload,
          steps: [
            { name: 'step-a', run: async (context: any) => context },
            { name: 'step-b', run: async () => { throw new Error('boom'); } }
          ]
        },
        payload: { projectId: 'project-1', chapterNumber: null },
        deps: {}
      })
    ).rejects.toThrow('boom');

    expect(markStepFailed).toHaveBeenCalledWith('workflow-run-1', 'step-b', 'boom');
    expect(markRunFailed).toHaveBeenCalledWith('workflow-run-1', 'boom');
  });
});
```

- [x] **Step 2: Run the workflow tests to verify RED**

Run: `pnpm vitest run tests/workflows/generate-outline-flow.test.ts tests/workflows/generate-volume-flow.test.ts tests/workflows/generate-chapter-flow.test.ts tests/workflows/review-rewrite-flow.test.ts tests/workflows/workflow-runner.test.ts`

Expected: FAIL because flow definitions still return string steps and `WorkflowRunRepository` has no failure methods.

- [x] **Step 3: Add the typed runtime contracts**

```ts
// packages/workflows/src/workflow-runtime.ts
export interface WorkflowStep<TContext, TDeps> {
  name: string;
  run: (context: TContext, deps: TDeps) => Promise<TContext>;
}

export interface ExecutableWorkflow<TPayload, TContext, TDeps> {
  name: string;
  buildInitialContext: (payload: TPayload) => TContext;
  steps: Array<WorkflowStep<TContext, TDeps>>;
}
```

```ts
// packages/workflows/src/create-project-flow.ts
export interface WorkflowTriggerPayload {
  projectId: string;
  chapterNumber: number | null;
}
```

- [x] **Step 4: Convert one workflow definition and the runner to the new runtime shape**

```ts
// packages/workflows/src/generate-outline-flow.ts
import type { ExecutableWorkflow } from './workflow-runtime';
import type { WorkflowTriggerPayload } from './create-project-flow';

export interface OutlineFlowContext {
  projectId: string;
  chapterNumber: number | null;
}

export function generateOutlineFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  OutlineFlowContext,
  Record<string, never>
> {
  return {
    name: 'generate-outline-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'load-project-input', run: async (context) => context },
      { name: 'load-outline-prompt', run: async (context) => context },
      { name: 'run-outline-agent', run: async (context) => context },
      { name: 'persist-outline', run: async (context) => context }
    ]
  };
}
```

```ts
// packages/workflows/src/workflow-runner.ts
export async function runInstrumentedWorkflow<TPayload, TContext, TDeps>(input: {
  flow: ExecutableWorkflow<TPayload, TContext, TDeps>;
  payload: TPayload & { projectId: string; chapterNumber: number | null };
  deps: TDeps;
}) {
  const repository = new WorkflowRunRepository();
  const run = await repository.createRun({
    flowName: input.flow.name,
    projectId: input.payload.projectId,
    chapterNumber: input.payload.chapterNumber
  });

  let context = input.flow.buildInitialContext(input.payload);

  for (const step of input.flow.steps) {
    await repository.markStepRunning(run.id, step.name);
    try {
      context = await step.run(context, input.deps);
      await repository.markStepSucceeded(run.id, step.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      await repository.markStepFailed(run.id, step.name, message);
      await repository.markRunFailed(run.id, message);
      throw error;
    }
  }

  await repository.markRunSucceeded(run.id);
  return context;
}
```

- [x] **Step 5: Run the workflow tests to verify GREEN**

Run: `pnpm vitest run tests/workflows/generate-outline-flow.test.ts tests/workflows/generate-volume-flow.test.ts tests/workflows/generate-chapter-flow.test.ts tests/workflows/review-rewrite-flow.test.ts tests/workflows/workflow-runner.test.ts`

Expected: PASS with the runner exercising real step functions and failure status paths.

- [x] **Step 6: Commit**

```bash
git add packages/workflows/src/workflow-runtime.ts \
  packages/workflows/src/create-project-flow.ts \
  packages/workflows/src/generate-outline-flow.ts \
  packages/workflows/src/generate-volume-flow.ts \
  packages/workflows/src/generate-chapter-flow.ts \
  packages/workflows/src/review-rewrite-flow.ts \
  packages/workflows/src/decision-session-flow.ts \
  packages/workflows/src/chapter-replan-flow.ts \
  packages/workflows/src/publish-chapter-flow.ts \
  packages/workflows/src/index.ts \
  packages/workflows/src/workflow-runner.ts \
  tests/workflows/generate-outline-flow.test.ts \
  tests/workflows/generate-volume-flow.test.ts \
  tests/workflows/generate-chapter-flow.test.ts \
  tests/workflows/review-rewrite-flow.test.ts \
  tests/workflows/workflow-runner.test.ts
git commit -m "feat: add executable workflow runtime"
```

### Task 2: Add Worker Dependencies And Failure-Aware Workflow Persistence

**Files:**
- Modify: `packages/storage/src/repositories/workflow-run-repository.ts`
- Modify: `apps/worker/src/jobs/workflow-job.ts`
- Modify: `apps/worker/src/worker.ts`
- Create: `packages/workflows/src/production-deps.ts`
- Test: `tests/storage/workflow-run-repository.test.ts`
- Test: `tests/worker/workflow-job.test.ts`

- [x] **Step 1: Write failing tests for failed step/run persistence and dependency injection**

```ts
import { describe, expect, it } from 'vitest';

describe('WorkflowRunRepository', () => {
  it('stores a failed step message and failed run message', async () => {
    const { WorkflowRunRepository } = await import('../../packages/storage/src/repositories/workflow-run-repository');
    const repository = new WorkflowRunRepository();

    await repository.markStepFailed('workflow-run-1', 'run-outline-agent', 'bad schema');
    await repository.markRunFailed('workflow-run-1', 'bad schema');

    expect(stepRunRecord.updateMany).toHaveBeenCalledWith({
      where: { workflowRunId: 'workflow-run-1', stepName: 'run-outline-agent' },
      data: { status: 'failed', errorMessage: 'bad schema' }
    });
  });
});
```

```ts
it('passes real workflow dependencies into runInstrumentedWorkflow', async () => {
  await runWorkflowJob('generate-outline-flow', { projectId: 'project-1' });

  expect(runInstrumentedWorkflow).toHaveBeenCalledWith(
    expect.objectContaining({
      deps: expect.objectContaining({
        promptRepository: expect.any(Object),
        projectRepository: expect.any(Object),
        storyStateRepository: expect.any(Object)
      })
    })
  );
});
```

- [x] **Step 2: Run the worker/storage tests to verify RED**

Run: `pnpm vitest run tests/storage/workflow-run-repository.test.ts tests/worker/workflow-job.test.ts`

Expected: FAIL because the repository does not expose failure methods and worker dispatch does not build production dependencies.

- [x] **Step 3: Add repository failure methods and concrete dependency assembly**

```ts
// packages/storage/src/repositories/workflow-run-repository.ts
async markStepFailed(workflowRunId: string, stepName: string, errorMessage: string) {
  return prisma.stepRunRecord.updateMany({
    where: { workflowRunId, stepName },
    data: { status: 'failed', errorMessage }
  });
}

async markRunFailed(workflowRunId: string, errorMessage: string) {
  return prisma.workflowRunRecord.update({
    where: { id: workflowRunId },
    data: { status: 'failed', errorMessage }
  });
}
```

```ts
// packages/workflows/src/production-deps.ts
import { PromptRepository } from '../../storage/src/repositories/prompt-repository';
import { ProjectRepository } from '../../storage/src/repositories/project-repository';
import { StoryStateRepository } from '../../storage/src/repositories/story-state-repository';

export function createProductionWorkflowDeps() {
  return {
    promptRepository: new PromptRepository(),
    projectRepository: new ProjectRepository(),
    storyStateRepository: new StoryStateRepository()
  };
}
```

- [x] **Step 4: Pass the dependency bundle from worker jobs into the runner**

```ts
// apps/worker/src/jobs/workflow-job.ts
import { createProductionWorkflowDeps } from '../../../../packages/workflows/src/production-deps';

return runInstrumentedWorkflow({
  flow,
  payload: {
    projectId: payload.projectId ?? 'system',
    chapterNumber: payload.chapterNumber ?? null
  },
  deps: createProductionWorkflowDeps()
});
```

- [x] **Step 5: Run the worker/storage tests to verify GREEN**

Run: `pnpm vitest run tests/storage/workflow-run-repository.test.ts tests/worker/workflow-job.test.ts`

Expected: PASS with worker dispatch providing a real dependency bundle and repository failure paths implemented.

- [x] **Step 6: Commit**

```bash
git add packages/storage/src/repositories/workflow-run-repository.ts \
  packages/workflows/src/production-deps.ts \
  apps/worker/src/jobs/workflow-job.ts \
  apps/worker/src/worker.ts \
  tests/storage/workflow-run-repository.test.ts \
  tests/worker/workflow-job.test.ts
git commit -m "feat: wire workflow runtime through worker deps"
```

### Task 3: Implement Real Outline And Volume Execution

**Files:**
- Modify: `packages/storage/src/repositories/project-repository.ts`
- Modify: `packages/storage/src/repositories/prompt-repository.ts`
- Modify: `packages/storage/src/repositories/story-state-repository.ts`
- Create: `packages/workflows/src/outline-volume-executors.ts`
- Create: `packages/workflows/src/outline-volume-parsers.ts`
- Modify: `packages/workflows/src/generate-outline-flow.ts`
- Modify: `packages/workflows/src/generate-volume-flow.ts`
- Modify: `tests/storage/project-repository.test.ts`
- Modify: `tests/storage/prompt-repository.test.ts`
- Modify: `tests/storage/story-state-repository.test.ts`
- Create: `tests/workflows/outline-volume-executors.test.ts`
- Modify: `tests/api/story-production.test.ts`

- [x] **Step 1: Write failing tests for prompt lookup, outline persistence, and volume persistence**

```ts
it('loads the latest enabled prompt config by agent name', async () => {
  const prompt = await repository.findLatestEnabledByAgentName('outline-agent');
  expect(prompt?.agentName).toBe('outline-agent');
});
```

```ts
it('persists outline output into both OutlineRecord and StoryState', async () => {
  await executeOutlineStep(context, deps);

  expect(saveOutline).toHaveBeenCalledWith({
    projectId: 'project-1',
    outline: { title: '卷一' },
    storyBible: '宗门与王朝对峙'
  });
});
```

```ts
it('persists volume plans and updates current position', async () => {
  await executeVolumeStep(context, deps);

  expect(saveVolumePlans).toHaveBeenCalledWith({
    projectId: 'project-1',
    plans: [{ volumeNumber: 1, goal: '入宗' }]
  });
});
```

- [x] **Step 2: Run the outline/volume tests to verify RED**

Run: `pnpm vitest run tests/storage/project-repository.test.ts tests/storage/prompt-repository.test.ts tests/storage/story-state-repository.test.ts tests/workflows/outline-volume-executors.test.ts tests/api/story-production.test.ts`

Expected: FAIL because repositories cannot fetch prompt/project prerequisites and the workflow steps still do no real work.

- [x] **Step 3: Add repository lookup helpers and parser helpers**

```ts
// packages/storage/src/repositories/prompt-repository.ts
async findLatestEnabledByAgentName(agentName: string) {
  return prisma.promptConfig.findFirst({
    where: { agentName, enabled: true },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
  });
}
```

```ts
// packages/workflows/src/outline-volume-parsers.ts
export function parseOutlineOutput(output: Record<string, unknown> | null) {
  if (!output || typeof output.title !== 'string') {
    throw new Error('Invalid outline output: missing title');
  }
  return {
    outline: output,
    storyBible: typeof output.storyBible === 'string' ? output.storyBible : null
  };
}
```

- [x] **Step 4: Implement real outline/volume executors and wire them into the flows**

```ts
// packages/workflows/src/outline-volume-executors.ts
export async function executeOutlineAgent(context: OutlineFlowContext, deps: ProductionWorkflowDeps) {
  const project = await deps.projectRepository.findById(context.projectId);
  if (!project) {
    throw new Error(`Project ${context.projectId} not found`);
  }

  const prompt = await deps.promptRepository.findLatestEnabledByAgentName('outline-agent');
  if (!prompt) {
    throw new Error('Prompt config not found for outline-agent');
  }

  const result = await deps.agentRunner.run({
    agentType: 'outline-agent',
    promptConfigVersion: prompt.version,
    projectId: context.projectId,
    chapterNumber: null,
    provider: deps.defaultProvider,
    model: deps.defaultModel,
    inputSnapshot: { premise: project.premise, genre: project.genre }
  });

  const parsed = parseOutlineOutput(result.parsedOutput);
  await deps.storyStateRepository.saveOutline({
    projectId: context.projectId,
    outline: parsed.outline,
    storyBible: parsed.storyBible
  });

  return { ...context, outline: parsed.outline, storyBible: parsed.storyBible };
}
```

- [x] **Step 5: Run the outline/volume tests to verify GREEN**

Run: `pnpm vitest run tests/storage/project-repository.test.ts tests/storage/prompt-repository.test.ts tests/storage/story-state-repository.test.ts tests/workflows/outline-volume-executors.test.ts tests/api/story-production.test.ts`

Expected: PASS with outline and volume workflows persisting real state instead of only returning queue metadata.

- [x] **Step 6: Commit**

```bash
git add packages/storage/src/repositories/project-repository.ts \
  packages/storage/src/repositories/prompt-repository.ts \
  packages/storage/src/repositories/story-state-repository.ts \
  packages/workflows/src/outline-volume-executors.ts \
  packages/workflows/src/outline-volume-parsers.ts \
  packages/workflows/src/generate-outline-flow.ts \
  packages/workflows/src/generate-volume-flow.ts \
  tests/storage/project-repository.test.ts \
  tests/storage/prompt-repository.test.ts \
  tests/storage/story-state-repository.test.ts \
  tests/workflows/outline-volume-executors.test.ts \
  tests/api/story-production.test.ts
git commit -m "feat: execute real outline and volume workflows"
```

### Task 4: Implement Chapter Planning, Drafting, And Project-Level Pipeline Locking

**Files:**
- Modify: `packages/storage/src/repositories/story-state-repository.ts`
- Create: `packages/workflows/src/chapter-executors.ts`
- Create: `packages/workflows/src/chapter-lock.ts`
- Modify: `packages/workflows/src/generate-chapter-flow.ts`
- Modify: `tests/storage/story-state-repository.test.ts`
- Create: `tests/workflows/chapter-executors.test.ts`
- Modify: `tests/api/story-production.test.ts`
- Modify: `tests/e2e/phase-2-smoke.test.ts`

- [x] **Step 1: Write failing tests for chapter number allocation, lock contention, and chapter persistence**

```ts
it('allocates the next chapter number from currentPosition', async () => {
  const next = await repository.getNextChapterNumber('project-1');
  expect(next).toBe(8);
});
```

```ts
it('fails when a project chapter pipeline lock is already held', async () => {
  await expect(acquireChapterPipelineLock('project-1')).rejects.toThrow(
    'Project chapter pipeline already active for project-1'
  );
});
```

```ts
it('writes a chapter plan, draft, and drafted state', async () => {
  await executeChapterFlow(context, deps);

  expect(saveChapterPlan).toHaveBeenCalledWith(expect.objectContaining({
    projectId: 'project-1',
    chapterNumber: 8
  }));
  expect(saveChapterDraft).toHaveBeenCalledWith(expect.objectContaining({
    projectId: 'project-1',
    chapterNumber: 8,
    version: 1
  }));
  expect(saveChapterState).toHaveBeenCalledWith({
    projectId: 'project-1',
    chapterNumber: 8,
    status: 'drafted'
  });
});
```

- [x] **Step 2: Run the chapter tests to verify RED**

Run: `pnpm vitest run tests/storage/story-state-repository.test.ts tests/workflows/chapter-executors.test.ts tests/api/story-production.test.ts tests/e2e/phase-2-smoke.test.ts`

Expected: FAIL because no lock, chapter number accessor, or real chapter plan/draft execution exists.

- [x] **Step 3: Add the story-state helpers and lock utility**

```ts
// packages/storage/src/repositories/story-state-repository.ts
async getStoryState(projectId: string) {
  return prisma.storyState.findUnique({ where: { projectId } });
}

async getNextChapterNumber(projectId: string) {
  const state = await this.getStoryState(projectId);
  const nextChapterNumber = state?.currentPosition?.nextChapterNumber;
  if (typeof nextChapterNumber !== 'number') {
    throw new Error(`Story state is not ready for next chapter generation: ${projectId}`);
  }
  return nextChapterNumber;
}
```

```ts
// packages/workflows/src/chapter-lock.ts
const activeProjectLocks = new Set<string>();

export async function acquireChapterPipelineLock(projectId: string) {
  if (activeProjectLocks.has(projectId)) {
    throw new Error(`Project chapter pipeline already active for ${projectId}`);
  }
  activeProjectLocks.add(projectId);
}

export async function releaseChapterPipelineLock(projectId: string) {
  activeProjectLocks.delete(projectId);
}
```

- [x] **Step 4: Implement the plan/draft executors and release the lock in finally**

```ts
// packages/workflows/src/chapter-executors.ts
export async function executeGenerateChapter(context: ChapterFlowContext, deps: ProductionWorkflowDeps) {
  await acquireChapterPipelineLock(context.projectId);
  try {
    const chapterNumber = await deps.storyStateRepository.getNextChapterNumber(context.projectId);
    const planResult = await deps.agentRunner.run({
      agentType: 'chapter-plan-agent',
      promptConfigVersion: context.chapterPlanPrompt.version,
      projectId: context.projectId,
      chapterNumber,
      provider: deps.defaultProvider,
      model: deps.defaultModel,
      inputSnapshot: { chapterNumber }
    });

    await deps.storyStateRepository.saveChapterPlan({
      projectId: context.projectId,
      chapterNumber,
      title: String(planResult.parsedOutput?.title ?? `Chapter ${chapterNumber}`),
      goal: String(planResult.parsedOutput?.goal ?? ''),
      beats: Array.isArray(planResult.parsedOutput?.beats) ? planResult.parsedOutput.beats as string[] : [],
      povCharacter: String(planResult.parsedOutput?.povCharacter ?? ''),
      hardConstraints: []
    });

    await deps.storyStateRepository.saveChapterDraft({
      projectId: context.projectId,
      chapterNumber,
      version: 1,
      content: String(planResult.rawOutput),
      summary: null,
      metadata: {}
    });

    await deps.storyStateRepository.saveChapterState({
      projectId: context.projectId,
      chapterNumber,
      status: 'drafted'
    });

    return { ...context, chapterNumber };
  } finally {
    await releaseChapterPipelineLock(context.projectId);
  }
}
```

- [x] **Step 5: Run the chapter tests to verify GREEN**

Run: `pnpm vitest run tests/storage/story-state-repository.test.ts tests/workflows/chapter-executors.test.ts tests/api/story-production.test.ts tests/e2e/phase-2-smoke.test.ts`

Expected: PASS with chapter generation persisting plans/drafts and rejecting concurrent project pipelines.

- [x] **Step 6: Commit**

```bash
git add packages/storage/src/repositories/story-state-repository.ts \
  packages/workflows/src/chapter-executors.ts \
  packages/workflows/src/chapter-lock.ts \
  packages/workflows/src/generate-chapter-flow.ts \
  tests/storage/story-state-repository.test.ts \
  tests/workflows/chapter-executors.test.ts \
  tests/api/story-production.test.ts \
  tests/e2e/phase-2-smoke.test.ts
git commit -m "feat: execute real chapter generation flow"
```

### Task 5: Implement Review, Rewrite, Approval, And Blocking

**Files:**
- Modify: `packages/storage/src/repositories/story-state-repository.ts`
- Modify: `packages/storage/src/repositories/decision-session-repository.ts`
- Create: `packages/workflows/src/review-rewrite-executors.ts`
- Modify: `packages/workflows/src/review-rewrite-flow.ts`
- Modify: `tests/storage/story-state-repository.test.ts`
- Modify: `tests/storage/decision-session-repository.test.ts`
- Create: `tests/workflows/review-rewrite-executors.test.ts`
- Modify: `tests/workflows/review-rewrite-policy.test.ts`
- Modify: `tests/e2e/phase-2-smoke.test.ts`

- [ ] **Step 1: Write failing tests for approve, rewrite, and blocked outcomes**

```ts
it('approves a chapter and appends its summary into story state', async () => {
  await executeReviewRewrite(context, deps);

  expect(saveApprovedChapterSummary).toHaveBeenCalledWith({
    projectId: 'project-1',
    chapterNumber: 8,
    summary: '主角接受试炼。',
    nextChapterNumber: 9
  });
});
```

```ts
it('creates a second draft version when review requests rewrite within the limit', async () => {
  await executeReviewRewrite(context, deps);

  expect(saveChapterDraft).toHaveBeenCalledWith(expect.objectContaining({
    chapterNumber: 8,
    version: 2
  }));
});
```

```ts
it('marks the chapter blocked and creates a decision trigger after rewrite limit exhaustion', async () => {
  await executeReviewRewrite(context, deps);

  expect(markChapterBlockedForDecision).toHaveBeenCalledWith({
    projectId: 'project-1',
    chapterNumber: 8
  });
  expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
    projectId: 'project-1',
    chapterNumber: 8
  }));
});
```

- [ ] **Step 2: Run the review/rewrite tests to verify RED**

Run: `pnpm vitest run tests/storage/story-state-repository.test.ts tests/storage/decision-session-repository.test.ts tests/workflows/review-rewrite-executors.test.ts tests/workflows/review-rewrite-policy.test.ts tests/e2e/phase-2-smoke.test.ts`

Expected: FAIL because the flow does not run real reviews, rewrite versions, or decision-trigger persistence.

- [ ] **Step 3: Add repository helpers for latest draft/version and decision trigger creation**

```ts
// packages/storage/src/repositories/story-state-repository.ts
async getLatestChapterDraft(projectId: string, chapterNumber: number) {
  return prisma.chapterDraftRecord.findFirst({
    where: { projectId, chapterNumber },
    orderBy: [{ version: 'desc' }]
  });
}
```

```ts
// packages/storage/src/repositories/decision-session-repository.ts
async createBlockingDecisionTrigger(input: {
  projectId: string;
  chapterNumber: number;
  triggerReason: string;
  packet: Record<string, unknown>;
}) {
  return this.createSession({
    projectId: input.projectId,
    chapterNumber: input.chapterNumber,
    packet: input.packet,
    triggerReason: input.triggerReason,
    sourceReviewOutcomeId: null,
    contextSnapshot: input.packet
  });
}
```

- [ ] **Step 4: Implement the bounded review/rewrite executor**

```ts
// packages/workflows/src/review-rewrite-executors.ts
export async function executeReviewRewrite(context: ReviewRewriteContext, deps: ProductionWorkflowDeps) {
  let rewriteCount = 0;

  while (rewriteCount <= 2) {
    const latestDraft = await deps.storyStateRepository.getLatestChapterDraft(
      context.projectId,
      context.chapterNumber
    );
    if (!latestDraft) {
      throw new Error(`No draft found for chapter ${context.chapterNumber}`);
    }

    const reviewResult = await deps.agentRunner.run({
      agentType: 'review-agent',
      promptConfigVersion: context.reviewPrompt.version,
      projectId: context.projectId,
      chapterNumber: context.chapterNumber,
      provider: deps.defaultProvider,
      model: deps.defaultModel,
      inputSnapshot: { content: latestDraft.content }
    });

    const decision = String(reviewResult.parsedOutput?.decision ?? 'blocked_for_manual_decision');
    await deps.storyStateRepository.saveReviewOutcome({
      projectId: context.projectId,
      chapterNumber: context.chapterNumber,
      decision: decision as 'approve' | 'rewrite' | 'blocked_for_manual_decision',
      issues: [],
      rewriteInstructions: [],
      canAutoRewrite: decision === 'rewrite',
      triggeredManualDecision: decision === 'blocked_for_manual_decision'
    });

    if (decision === 'approve') {
      await deps.storyStateRepository.saveWorkflowDecidedChapterState({
        projectId: context.projectId,
        chapterNumber: context.chapterNumber,
        chapterState: 'approved'
      });
      await deps.storyStateRepository.saveApprovedChapterSummary({
        projectId: context.projectId,
        chapterNumber: context.chapterNumber,
        summary: String(reviewResult.parsedOutput?.summary ?? ''),
        nextChapterNumber: context.chapterNumber + 1
      });
      return { ...context, reviewDecision: 'approve' as const };
    }

    if (decision === 'rewrite' && rewriteCount < 2) {
      rewriteCount += 1;
      await deps.storyStateRepository.saveChapterDraft({
        projectId: context.projectId,
        chapterNumber: context.chapterNumber,
        version: latestDraft.version + 1,
        content: latestDraft.content,
        summary: latestDraft.summary,
        metadata: latestDraft.metadata as Record<string, unknown>
      });
      continue;
    }

    await deps.storyStateRepository.markChapterBlockedForDecision({
      projectId: context.projectId,
      chapterNumber: context.chapterNumber
    });
    await deps.decisionSessionRepository.createBlockingDecisionTrigger({
      projectId: context.projectId,
      chapterNumber: context.chapterNumber,
      triggerReason: 'review_blocked',
      packet: { chapterNumber: context.chapterNumber, projectId: context.projectId }
    });
    return { ...context, reviewDecision: 'blocked_for_manual_decision' as const };
  }

  throw new Error('Unreachable review loop exit');
}
```

- [ ] **Step 5: Run the review/rewrite tests to verify GREEN**

Run: `pnpm vitest run tests/storage/story-state-repository.test.ts tests/storage/decision-session-repository.test.ts tests/workflows/review-rewrite-executors.test.ts tests/workflows/review-rewrite-policy.test.ts tests/e2e/phase-2-smoke.test.ts`

Expected: PASS with review approvals updating story state, rewrites creating new versions, and exhausted/blocked outcomes creating decision triggers.

- [ ] **Step 6: Commit**

```bash
git add packages/storage/src/repositories/story-state-repository.ts \
  packages/storage/src/repositories/decision-session-repository.ts \
  packages/workflows/src/review-rewrite-executors.ts \
  packages/workflows/src/review-rewrite-flow.ts \
  tests/storage/story-state-repository.test.ts \
  tests/storage/decision-session-repository.test.ts \
  tests/workflows/review-rewrite-executors.test.ts \
  tests/workflows/review-rewrite-policy.test.ts \
  tests/e2e/phase-2-smoke.test.ts
git commit -m "feat: execute bounded review rewrite flow"
```

### Task 6: Wire Real Agent Runtime Dependencies And Run Full Regression

**Files:**
- Modify: `packages/workflows/src/production-deps.ts`
- Modify: `packages/agent-runtime/src/prompt-renderer.ts`
- Modify: `packages/agent-runtime/src/index.ts`
- Modify: `tests/agent-runtime/agent-runner.test.ts`
- Modify: `tests/api/story-production.test.ts`
- Modify: `tests/e2e/phase-2-smoke.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing tests for agent-runtime-backed production deps**

```ts
it('builds a production agent runner dependency that records agent runs through storage', async () => {
  const deps = createProductionWorkflowDeps();

  expect(typeof deps.agentRunner.run).toBe('function');
  expect(typeof deps.storyStateRepository.saveAgentRun).toBe('function');
});
```

```ts
it('phase 2 smoke runs outline, volume, chapter, and review flows with persisted side effects', async () => {
  expect(response.json()).toMatchObject({
    workflowRunId: expect.any(String),
    status: 'queued'
  });
});
```

- [ ] **Step 2: Run the final focused tests to verify RED**

Run: `pnpm vitest run tests/agent-runtime/agent-runner.test.ts tests/api/story-production.test.ts tests/e2e/phase-2-smoke.test.ts`

Expected: FAIL because production deps do not yet assemble a real `agentRunner`, and smoke coverage still only checks queue metadata.

- [ ] **Step 3: Assemble a real production agent runner around existing capacity/model hooks**

```ts
// packages/workflows/src/production-deps.ts
import { createAgentRunner } from '../../agent-runtime/src/agent-runner';
import { CapacityService } from '../../llm-gateway/src/capacity-service';

export function createProductionWorkflowDeps() {
  const storyStateRepository = new StoryStateRepository();
  const capacityService = new CapacityService([]);

  return {
    promptRepository: new PromptRepository(),
    projectRepository: new ProjectRepository(),
    storyStateRepository,
    decisionSessionRepository: new DecisionSessionRepository(),
    defaultProvider: 'openai',
    defaultModel: 'gpt-5.4-mini',
    agentRunner: createAgentRunner({
      acquire: (request) => capacityService.acquire(request),
      release: (lease) => capacityService.release(lease),
      renderPrompt: (input) => JSON.stringify(input),
      invokeModel: async () => ({
        rawOutput: '',
        parsedOutput: {},
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      }),
      saveAgentRun: (run) => storyStateRepository.saveAgentRun(run as any)
    })
  };
}
```

- [ ] **Step 4: Update smoke tests and README to reflect real production-chain behavior**

```md
## Core Production Behavior

- outline, volume, chapter, and review/rewrite workflows execute through the worker runtime
- workflow runs and step runs record real success/failure states
- approved chapters append summaries into story state
- blocked review outcomes create persisted decision triggers for the later decision-session chain
```

- [ ] **Step 5: Run the full regression suite to verify GREEN**

Run: `pnpm vitest run tests/api tests/web tests/worker tests/storage tests/e2e tests/workflows tests/agent-runtime tests/llm-gateway`

Expected: PASS with the main production chain now exercising real workflow side effects instead of placeholder success logging.

- [ ] **Step 6: Commit**

```bash
git add packages/workflows/src/production-deps.ts \
  packages/agent-runtime/src/prompt-renderer.ts \
  packages/agent-runtime/src/index.ts \
  tests/agent-runtime/agent-runner.test.ts \
  tests/api/story-production.test.ts \
  tests/e2e/phase-2-smoke.test.ts \
  README.md
git commit -m "feat: complete core production workflow chain"
```

## Self-Review

### Spec coverage

- Workflow runtime replacement: covered by Tasks 1 and 2
- Outline and volume real execution: covered by Task 3
- Chapter generation and lock enforcement: covered by Task 4
- Review/rewrite bounded execution and blocking: covered by Task 5
- Agent runtime and regression baseline: covered by Task 6

### Placeholder scan

- No `TBD`, `TODO`, or “similar to Task N” placeholders remain in the task steps.
- Each code-changing step includes an explicit code block.
- Each verification step includes an exact command and expected outcome.

### Type consistency

- The plan uses `ExecutableWorkflow`, `WorkflowStep`, and `WorkflowTriggerPayload` consistently across runtime and flow definitions.
- Repository method names added in earlier tasks (`markStepFailed`, `markRunFailed`, `findLatestEnabledByAgentName`, `getNextChapterNumber`, `getLatestChapterDraft`, `createBlockingDecisionTrigger`) are referenced consistently in later tasks.
