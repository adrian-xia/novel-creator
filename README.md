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
