# novel-creator

## Setup

1. `corepack pnpm install`
2. `docker compose up -d postgres redis`
3. `corepack pnpm --filter @novel-creator/storage prisma migrate dev`
4. `corepack pnpm dev`

## Phase 1 Expected Behavior

- `POST /projects` creates a project payload
- prompt configs can be listed and updated
- capacity service can lease a provider key
- worker can enqueue a placeholder workflow job
- web dashboard renders the internal control panel shell

## Phase 2 Expected Behavior

- `POST /projects/:projectId/flows/outline` queues outline generation
- `POST /projects/:projectId/flows/volume` queues volume generation
- `POST /projects/:projectId/flows/next-chapter` queues the next chapter pipeline
- project detail UI shows outline, volumes, chapters, and recent agent runs
- review/rewrite logic stops after two automatic rewrite attempts

## Phase 3 Expected Behavior

- blocked review outcomes can enter a decision session flow
- projects expose publish-profile APIs for automatic publish targets and manual export targets
- manual export tasks support ready and confirm transitions
- worker records workflow instrumentation through workflow-run execution
- internal control panel includes decision queue, publish center, and workflow run pages
