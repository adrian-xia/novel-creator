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
