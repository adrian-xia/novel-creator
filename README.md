# novel-creator

## Setup

1. `corepack pnpm install`
2. `docker compose up -d postgres redis`
3. `corepack pnpm --filter @novel-creator/storage prisma migrate dev`
4. `corepack pnpm dev`

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
