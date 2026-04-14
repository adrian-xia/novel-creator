# novel-creator

## Setup

1. `corepack pnpm install`
2. `docker compose up -d postgres redis`
3. `corepack pnpm --filter @novel-creator/storage prisma migrate dev`
4. `corepack pnpm prompts:seed`
5. `corepack pnpm dev`

Optional runtime overrides:

- `WORKFLOW_DEFAULT_PROVIDER` selects which provider name the production worker requests by default
- `WORKFLOW_DEFAULT_MODEL` selects which model the production worker requests by default
- `OPENAI_BASE_URL` and `OPENAI_PROTOCOL_MODE` can provide an `.env` fallback for OpenAI-compatible runtimes when no matching provider-capacity row exists yet
- provider-capacity records still take precedence when present and remain the durable multi-key configuration path

Prompt bootstrap:

- `pnpm prompts:seed` applies the initial six-agent prompt catalog directly to PostgreSQL
- `POST /prompts/bootstrap` provides the same bootstrap flow through the API
- `/prompts` in the web app now lists persisted prompt configs and exposes a bootstrap button

## Core Production Chain

- outline, volume, chapter, review/rewrite, decision-session, and publish workflows all execute through the shared worker/runtime path
- production workflow deps assemble a real agent runner with provider-capacity leasing, prompt rendering, OpenAI-compatible invocation, and persisted agent-run audits
- review/rewrite execution is bounded to two automatic rewrite attempts before the chapter is blocked for a manual decision trigger
- approved chapters append summaries back into story state so later chapter planning can continue from persisted context
- blocked review outcomes create persisted decision-session triggers for the downstream recovery flow
- the focused production checks plus the full Vitest regression suite are expected to pass before merging workflow-chain changes

## Phase 1 Expected Behavior

- `POST /projects` persists a project through the storage-backed API
- prompt configs can be created through the storage-backed API
- provider capacity registrations can be persisted through the storage-backed API
- worker rejects unknown workflow jobs instead of running placeholder flows
- web dashboard renders the internal control panel shell

## Phase 2 Expected Behavior

- `POST /projects/:projectId/flows/outline` queues outline generation and records a workflow run
- `POST /projects/:projectId/flows/volume` queues volume generation and records a workflow run
- `POST /projects/:projectId/flows/next-chapter` queues the next chapter pipeline and records a workflow run
- project detail UI shows outline, volumes, chapters, and recent agent runs
- review/rewrite logic stops after two automatic rewrite attempts

## Phase 3 Expected Behavior

- blocked review outcomes can enter a decision session flow
- projects expose publish-profile APIs for automatic publish targets and manual export targets
- manual export tasks support ready and confirm transitions
- worker records workflow instrumentation through workflow-run execution
- internal control panel includes decision queue, publish center, and workflow run pages

## Phase 4 Expected Behavior

- provider capacity records can target third-party OpenAI-compatible relays via per-capacity `baseUrl`, `apiKeySecretRef`, and `protocolMode`
- blocked review outcomes open a real multi-turn decision session
- decision-session messages persist and can generate structured draft resolutions
- confirmed resolutions can define a dynamic replan window
- recovery tasks can invalidate existing plans and resume from a specific chapter
- decision-session detail pages expose message, draft-generation, and resolution-confirmation actions through web proxy routes
- approved chapters expose exportable-chapter, preview, and download surfaces for `plain_text`, `markdown`, and `bundle` exports
- publish center can preview/export approved chapter batches and inspect live publish tasks plus workflow-run data from the API
- external platform auto-upload remains intentionally unsupported; manual export is the supported publish path
