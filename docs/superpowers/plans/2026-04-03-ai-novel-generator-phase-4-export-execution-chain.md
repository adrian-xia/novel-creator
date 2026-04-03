# AI Novel Generator Phase 4 Export Execution Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a synchronous, manual export execution chain for approved chapters that supports batch selection, preview, and one-shot download for `plain_text`, `markdown`, and `bundle` outputs without touching real platform publishing.

**Architecture:** Keep this slice separate from the existing `PublishTask` / `ExportArtifact` persistence flow. Query approved chapter content directly from storage, normalize missing chapter titles to a deterministic fallback label before export assembly, assemble export payloads in `packages/agent-runtime`, expose thin Fastify routes for exportable chapters / preview / download, and extend the existing `Publish Center` with an export batch panel plus a small Next route handler to proxy file downloads.

**Tech Stack:** `TypeScript`, `pnpm`, `Vitest`, `Fastify`, `Next.js`, `Prisma`, `JSZip`, `superpower`

---

## File Structure

### New files and responsibilities

- `packages/domain/src/export-execution.ts`
  - transient export request / preview / generated-export types
- `packages/storage/src/repositories/export-execution-repository.ts`
  - approved-chapter export queries and latest-draft loading
- `packages/agent-runtime/src/export-execution.ts`
  - chapter selection normalization, preview assembly, and generated export building
- `apps/api/src/routes/export-execution.ts`
  - exportable-chapter, preview, and synchronous download routes
- `apps/web/src/app/publish/export/route.ts`
  - Next route handler that proxies synchronous export downloads to the API
- `tests/storage/phase-4-export-execution-types.test.ts`
  - type contract test for export execution models
- `tests/storage/export-execution-repository.test.ts`
  - approved-chapter query and latest-draft loading tests
- `tests/agent-runtime/export-execution.test.ts`
  - preview / text export / bundle zip assembly tests
- `tests/api/export-execution.test.ts`
  - export API route tests
- `tests/web/export-download-route.test.ts`
  - Next download proxy route tests
- `tests/e2e/phase-4-export-execution-smoke.test.ts`
  - export surface smoke coverage

### Existing files to modify

- `packages/domain/src/index.ts`
  - export the new export execution types
- `packages/agent-runtime/package.json`
  - add `jszip` dependency for bundle creation
- `pnpm-lock.yaml`
  - record the workspace dependency update for `jszip`
- `packages/agent-runtime/src/index.ts`
  - export the new export execution helpers
- `apps/api/src/app.ts`
  - register export execution routes
- `apps/api/src/routes/validation.ts`
  - add export batch payload parsing
- `apps/web/src/lib/api.ts`
  - add exportable-chapters and preview helpers
- `apps/web/src/app/publish/page.tsx`
  - render export batch selector, preview area, and export form
- `apps/web/src/app/projects/[projectId]/page.tsx`
  - link project detail to the project-scoped publish center entry point
- `tests/web/publish-center.test.tsx`
  - cover export batch UI rendering
- `tests/web/project-detail.test.tsx`
  - cover the project-scoped publish link
- `README.md`
  - document the Phase 4 export execution behavior

## Task 1: Add Export Execution Domain Contracts

**Files:**
- Create: `packages/domain/src/export-execution.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `tests/storage/phase-4-export-execution-types.test.ts`

- [ ] **Step 1: Write the failing type contract test**

```ts
// tests/storage/phase-4-export-execution-types.test.ts
import { describe, expectTypeOf, it } from 'vitest';
import type {
  ExportBatchRequest,
  ExportPreview,
  ExportableChapter,
  GeneratedExport
} from '../../packages/domain/src';

describe('phase 4 export execution contracts', () => {
  it('exports synchronous export request and response types', () => {
    expectTypeOf<ExportableChapter>().toEqualTypeOf<{
      projectId: string;
      chapterNumber: number;
      title: string;
      summary: string;
      updatedAt: string;
    }>();

    expectTypeOf<ExportBatchRequest>().toEqualTypeOf<{
      projectId: string;
      chapterNumbers: number[];
      format: 'plain_text' | 'markdown' | 'bundle';
    }>();

    expectTypeOf<ExportPreview>().toMatchTypeOf<{
      projectId: string;
      chapterNumbers: number[];
      format: 'plain_text' | 'markdown' | 'bundle';
      chapterCount: number;
      chapterSummaries: Array<{
        chapterNumber: number;
        title: string;
        summary: string;
        wordCount: number;
      }>;
    }>();

    expectTypeOf<GeneratedExport>().toEqualTypeOf<{
      fileName: string;
      contentType: string;
      content: string | Uint8Array;
      kind: 'text' | 'binary';
    }>();
  });
});
```

- [ ] **Step 2: Run the typecheck to verify it fails**

Run: `corepack pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --strict --esModuleInterop --skipLibCheck --resolveJsonModule --baseUrl . tests/storage/phase-4-export-execution-types.test.ts`
Expected: FAIL with missing exports from `../../packages/domain/src`

- [ ] **Step 3: Add the domain contracts**

```ts
// packages/domain/src/export-execution.ts
import type { ExportFormat } from './publishing';

export interface ExportableChapter {
  projectId: string;
  chapterNumber: number;
  // Title is always populated for export surfaces. Missing source titles are normalized to `Chapter ${chapterNumber}`.
  title: string;
  summary: string;
  updatedAt: string;
}

export interface ExportBatchRequest {
  projectId: string;
  chapterNumbers: number[];
  format: ExportFormat;
}

export interface ExportPreviewChapterSummary {
  chapterNumber: number;
  title: string;
  summary: string;
  wordCount: number;
}

export type ExportPreview =
  | {
      projectId: string;
      chapterNumbers: number[];
      format: 'plain_text' | 'markdown';
      chapterCount: number;
      content: string;
      chapterSummaries: ExportPreviewChapterSummary[];
    }
  | {
      projectId: string;
      chapterNumbers: number[];
      format: 'bundle';
      chapterCount: number;
      files: string[];
      manifest: Record<string, unknown>;
      chapterSummaries: ExportPreviewChapterSummary[];
    };

export interface GeneratedExport {
  fileName: string;
  contentType: string;
  content: string | Uint8Array;
  kind: 'text' | 'binary';
}
```

```ts
// packages/domain/src/index.ts
export * from './decision-session';
export * from './json';
export * from './project';
export * from './prompts';
export * from './provider-capacity';
export * from './publishing';
export * from './export-execution';
export * from './story-state';
export * from './workflow-run';
```

- [ ] **Step 4: Run the typecheck again**

Run: `corepack pnpm exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --strict --esModuleInterop --skipLibCheck --resolveJsonModule --baseUrl . tests/storage/phase-4-export-execution-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/export-execution.ts packages/domain/src/index.ts tests/storage/phase-4-export-execution-types.test.ts
git commit -m "feat: add export execution domain contracts"
```

## Task 2: Add Approved-Chapter Export Queries In Storage

**Files:**
- Create: `packages/storage/src/repositories/export-execution-repository.ts`
- Modify: `tests/storage/storage-package.test.ts`
- Test: `tests/storage/export-execution-repository.test.ts`

- [ ] **Step 1: Write the failing storage tests**

```ts
// tests/storage/export-execution-repository.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  chapterStateRecord: { findMany: vi.fn() },
  chapterDraftRecord: { findMany: vi.fn() },
  chapterPlanRecord: { findMany: vi.fn() }
}));

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('ExportExecutionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists only approved chapters as exportable choices', async () => {
    prisma.chapterStateRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, status: 'approved', updatedAt: new Date('2026-04-03T00:00:00.000Z') },
      { projectId: 'project-1', chapterNumber: 9, status: 'approved', updatedAt: new Date('2026-04-03T01:00:00.000Z') }
    ]);
    prisma.chapterDraftRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, version: 2, content: 'Chapter 8 text', summary: 'Chapter 8 summary', metadata: {} },
      { projectId: 'project-1', chapterNumber: 9, version: 1, content: 'Chapter 9 text', summary: 'Chapter 9 summary', metadata: {} }
    ]);
    prisma.chapterPlanRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, payload: { title: 'Chapter Eight' } },
      { projectId: 'project-1', chapterNumber: 9, payload: { title: 'Chapter Nine' } }
    ]);

    const { ExportExecutionRepository } = await import('../../packages/storage/src/repositories/export-execution-repository');
    const repository = new ExportExecutionRepository();

    await expect(repository.listExportableChapters('project-1')).resolves.toEqual([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'Chapter 8 summary',
        updatedAt: '2026-04-03T00:00:00.000Z'
      },
      {
        projectId: 'project-1',
        chapterNumber: 9,
        title: 'Chapter Nine',
        summary: 'Chapter 9 summary',
        updatedAt: '2026-04-03T01:00:00.000Z'
      }
    ]);
  });

  it('loads the latest approved chapter drafts for a batch export', async () => {
    prisma.chapterStateRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, status: 'approved' },
      { projectId: 'project-1', chapterNumber: 9, status: 'approved' }
    ]);
    prisma.chapterDraftRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, version: 1, content: 'old 8', summary: 'old summary', metadata: {} },
      { projectId: 'project-1', chapterNumber: 8, version: 2, content: 'new 8', summary: 'new summary', metadata: {} },
      { projectId: 'project-1', chapterNumber: 9, version: 1, content: 'new 9', summary: 'chapter 9 summary', metadata: {} }
    ]);
    prisma.chapterPlanRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, payload: { title: 'Chapter Eight' } },
      { projectId: 'project-1', chapterNumber: 9, payload: { title: 'Chapter Nine' } }
    ]);

    const { ExportExecutionRepository } = await import('../../packages/storage/src/repositories/export-execution-repository');
    const repository = new ExportExecutionRepository();

    await expect(
      repository.loadApprovedChaptersForExport({
        projectId: 'project-1',
        chapterNumbers: [9, 8]
      })
    ).resolves.toEqual([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'new summary',
        content: 'new 8'
      },
      {
        projectId: 'project-1',
        chapterNumber: 9,
        title: 'Chapter Nine',
        summary: 'chapter 9 summary',
        content: 'new 9'
      }
    ]);
  });

  it('rejects approved chapters that are missing export content', async () => {
    prisma.chapterStateRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, status: 'approved' }
    ]);
    prisma.chapterDraftRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, version: 2, content: '', summary: 'Chapter 8 summary', metadata: {} }
    ]);
    prisma.chapterPlanRecord.findMany.mockResolvedValue([
      { projectId: 'project-1', chapterNumber: 8, payload: { title: 'Chapter Eight' } }
    ]);

    const { ExportExecutionRepository } = await import('../../packages/storage/src/repositories/export-execution-repository');
    const repository = new ExportExecutionRepository();

    await expect(
      repository.loadApprovedChaptersForExport({
        projectId: 'project-1',
        chapterNumbers: [8]
      })
    ).rejects.toThrow('Approved chapter 8 is missing export content');
  });
});
```

- [ ] **Step 2: Run the storage tests to verify they fail**

Run: `corepack pnpm vitest run tests/storage/export-execution-repository.test.ts`
Expected: FAIL with missing repository module

- [ ] **Step 3: Implement the export query repository**

```ts
// packages/storage/src/repositories/export-execution-repository.ts
import { prisma } from '../client';

function getChapterTitle(payload: unknown, chapterNumber: number) {
  if (payload && typeof payload === 'object' && 'title' in payload && typeof payload.title === 'string') {
    return payload.title;
  }

  return `Chapter ${chapterNumber}`;
}

export class ExportExecutionRepository {
  async listExportableChapters(projectId: string) {
    const approvedStates = await prisma.chapterStateRecord.findMany({
      where: { projectId, status: 'approved' },
      orderBy: { chapterNumber: 'asc' }
    });
    const chapterNumbers = approvedStates.map((state) => state.chapterNumber);

    const [drafts, plans] = await Promise.all([
      prisma.chapterDraftRecord.findMany({
        where: { projectId, chapterNumber: { in: chapterNumbers } },
        orderBy: [{ chapterNumber: 'asc' }, { version: 'desc' }]
      }),
      prisma.chapterPlanRecord.findMany({
        where: { projectId, chapterNumber: { in: chapterNumbers }, invalidatedAt: null },
        orderBy: [{ chapterNumber: 'asc' }, { createdAt: 'desc' }]
      })
    ]);

    const latestDraftByChapter = new Map<number, (typeof drafts)[number]>();
    for (const draft of drafts) {
      if (!latestDraftByChapter.has(draft.chapterNumber)) {
        latestDraftByChapter.set(draft.chapterNumber, draft);
      }
    }

    const planByChapter = new Map<number, (typeof plans)[number]>();
    for (const plan of plans) {
      if (!planByChapter.has(plan.chapterNumber)) {
        planByChapter.set(plan.chapterNumber, plan);
      }
    }

    return approvedStates.map((state) => {
      const draft = latestDraftByChapter.get(state.chapterNumber);
      if (!draft || !draft.summary) {
        throw new Error(`Approved chapter ${state.chapterNumber} is missing export summary`);
      }

      return {
        projectId,
        chapterNumber: state.chapterNumber,
        title: getChapterTitle(planByChapter.get(state.chapterNumber)?.payload, state.chapterNumber),
        summary: draft.summary,
        updatedAt: state.updatedAt.toISOString()
      };
    });
  }

  async loadApprovedChaptersForExport(input: { projectId: string; chapterNumbers: number[] }) {
    const chapterNumbers = [...input.chapterNumbers].sort((a, b) => a - b);
    const approvedStates = await prisma.chapterStateRecord.findMany({
      where: {
        projectId: input.projectId,
        chapterNumber: { in: chapterNumbers },
        status: 'approved'
      }
    });

    const approvedNumbers = new Set(approvedStates.map((state) => state.chapterNumber));
    const rejectedNumbers = chapterNumbers.filter((chapterNumber) => !approvedNumbers.has(chapterNumber));

    if (rejectedNumbers.length > 0) {
      throw new Error(`Export batch contains non-approved chapters: ${rejectedNumbers.join(', ')}`);
    }

    const [drafts, plans] = await Promise.all([
      prisma.chapterDraftRecord.findMany({
        where: { projectId: input.projectId, chapterNumber: { in: chapterNumbers } },
        orderBy: [{ chapterNumber: 'asc' }, { version: 'desc' }]
      }),
      prisma.chapterPlanRecord.findMany({
        where: { projectId: input.projectId, chapterNumber: { in: chapterNumbers }, invalidatedAt: null },
        orderBy: [{ chapterNumber: 'asc' }, { createdAt: 'desc' }]
      })
    ]);

    const latestDraftByChapter = new Map<number, (typeof drafts)[number]>();
    for (const draft of drafts) {
      if (!latestDraftByChapter.has(draft.chapterNumber)) {
        latestDraftByChapter.set(draft.chapterNumber, draft);
      }
    }

    const planByChapter = new Map<number, (typeof plans)[number]>();
    for (const plan of plans) {
      if (!planByChapter.has(plan.chapterNumber)) {
        planByChapter.set(plan.chapterNumber, plan);
      }
    }

    return chapterNumbers.map((chapterNumber) => {
      const draft = latestDraftByChapter.get(chapterNumber);
      if (!draft || !draft.summary || !draft.content) {
        throw new Error(`Approved chapter ${chapterNumber} is missing export content`);
      }

      return {
        projectId: input.projectId,
        chapterNumber,
        title: getChapterTitle(planByChapter.get(chapterNumber)?.payload, chapterNumber),
        summary: draft.summary,
        content: draft.content
      };
    });
  }
}
```

```ts
// tests/storage/storage-package.test.ts
const { ExportExecutionRepository } = await importFreshModule(
  'packages/storage/src/repositories/export-execution-repository.ts'
);
expect(new ExportExecutionRepository()).toBeInstanceOf(ExportExecutionRepository);
```

- [ ] **Step 4: Run the storage tests again**

Run: `corepack pnpm vitest run tests/storage/export-execution-repository.test.ts tests/storage/storage-package.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/storage/src/repositories/export-execution-repository.ts tests/storage/export-execution-repository.test.ts tests/storage/storage-package.test.ts
git commit -m "feat: query approved chapters for export"
```

## Task 3: Build Export Preview And Download Assembly

**Files:**
- Modify: `packages/agent-runtime/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `packages/agent-runtime/src/export-execution.ts`
- Modify: `packages/agent-runtime/src/index.ts`
- Test: `tests/agent-runtime/export-execution.test.ts`

- [ ] **Step 1: Write the failing runtime tests**

```ts
// tests/agent-runtime/export-execution.test.ts
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  buildExportPreview,
  buildGeneratedExport,
  normalizeExportBatchRequest
} from '../../packages/agent-runtime/src/export-execution';

describe('export execution helpers', () => {
  const chapters = [
    {
      projectId: 'project-1',
      chapterNumber: 8,
      title: 'Chapter Eight',
      summary: 'The trap closes.',
      content: 'Chapter 8 content.'
    },
    {
      projectId: 'project-1',
      chapterNumber: 9,
      title: 'Chapter Nine',
      summary: 'The escape begins.',
      content: 'Chapter 9 content.'
    }
  ];

  it('normalizes chapter selections before preview and export', () => {
    expect(
      normalizeExportBatchRequest({
        projectId: 'project-1',
        chapterNumbers: [9, 8],
        format: 'markdown'
      })
    ).toEqual({
      projectId: 'project-1',
      chapterNumbers: [8, 9],
      format: 'markdown'
    });
  });

  it('builds preview content for markdown exports', () => {
    const preview = buildExportPreview({
      request: {
        projectId: 'project-1',
        chapterNumbers: [8, 9],
        format: 'markdown'
      },
      chapters,
      exportedAt: '2026-04-03T00:00:00.000Z'
    });

    expect(preview.format).toBe('markdown');
    expect(preview.content).toContain('# Chapter Eight');
    expect(preview.content).toContain('Chapter 9 content.');
  });

  it('builds preview content for plain text exports', () => {
    const preview = buildExportPreview({
      request: {
        projectId: 'project-1',
        chapterNumbers: [8, 9],
        format: 'plain_text'
      },
      chapters,
      exportedAt: '2026-04-03T00:00:00.000Z'
    });

    expect(preview.format).toBe('plain_text');
    expect(preview.content).toContain('Chapter 8: Chapter Eight');
    expect(preview.content).toContain('---');
  });

  it('builds a bundle zip with the expected files', async () => {
    const generated = await buildGeneratedExport({
      request: {
        projectId: 'project-1',
        chapterNumbers: [8, 9],
        format: 'bundle'
      },
      chapters,
      exportedAt: '2026-04-03T00:00:00.000Z'
    });

    expect(generated.kind).toBe('binary');
    expect(generated.fileName).toBe('project-1-chapters-8-9.zip');

    const zip = await JSZip.loadAsync(generated.content as Uint8Array);
    expect(Object.keys(zip.files).sort()).toEqual([
      'chapter-summaries.json',
      'manifest.json',
      'manuscript.md'
    ]);

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    const preview = buildExportPreview({
      request: {
        projectId: 'project-1',
        chapterNumbers: [8, 9],
        format: 'bundle'
      },
      chapters,
      exportedAt: '2026-04-03T00:00:00.000Z'
    });

    expect(preview.format).toBe('bundle');
    expect(preview.manifest).toEqual(manifest);
  });

  it('rejects duplicate chapter numbers instead of silently deduplicating them', () => {
    expect(() =>
      normalizeExportBatchRequest({
        projectId: 'project-1',
        chapterNumbers: [8, 8],
        format: 'markdown'
      })
    ).toThrow('Duplicate chapter numbers are not allowed');
  });
});
```

- [ ] **Step 2: Run the runtime tests to verify they fail**

Run: `corepack pnpm vitest run tests/agent-runtime/export-execution.test.ts`
Expected: FAIL with missing module or missing `jszip`

- [ ] **Step 3: Add the runtime helper and zip dependency**

```json
// packages/agent-runtime/package.json
{
  "name": "@novel-creator/agent-runtime",
  "private": true,
  "version": "0.0.0",
  "dependencies": {
    "@novel-creator/domain": "workspace:*",
    "jszip": "^3.10.1"
  }
}
```

```ts
// packages/agent-runtime/src/export-execution.ts
import JSZip from 'jszip';
import type {
  ExportBatchRequest,
  ExportPreview,
  GeneratedExport
} from '@novel-creator/domain';

interface ExportChapterSource {
  projectId: string;
  chapterNumber: number;
  title: string;
  summary: string;
  content: string;
}

function normalizeChapterNumbers(chapterNumbers: number[]) {
  return [...chapterNumbers].sort((a, b) => a - b);
}

function countWords(value: string) {
  return value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length;
}

function buildPlainTextContent(chapters: ExportChapterSource[]) {
  return chapters
    .map((chapter) => [`Chapter ${chapter.chapterNumber}: ${chapter.title}`, '', chapter.content].join('\n'))
    .join('\n\n---\n\n');
}

function buildMarkdownContent(chapters: ExportChapterSource[]) {
  return chapters
    .map((chapter) => [`# ${chapter.title}`, '', chapter.content].join('\n'))
    .join('\n\n');
}

function buildChapterSummaries(chapters: ExportChapterSource[]) {
  return chapters.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    summary: chapter.summary,
    wordCount: countWords(chapter.content)
  }));
}

function assertUniqueChapterNumbers(chapterNumbers: number[]) {
  // This plan resolves the design doc's conflicting dedupe-vs-reject language in favor of explicit rejection.
  if (new Set(chapterNumbers).size !== chapterNumbers.length) {
    throw new Error('Duplicate chapter numbers are not allowed');
  }
}

function buildBundleManifest(input: {
  request: ExportBatchRequest;
  chapterSummaries: ReturnType<typeof buildChapterSummaries>;
  exportedAt: string;
}) {
  return {
    projectId: input.request.projectId,
    exportedAt: input.exportedAt,
    format: input.request.format,
    chapterNumbers: input.request.chapterNumbers,
    chapterCount: input.request.chapterNumbers.length,
    totalWordCount: input.chapterSummaries.reduce((sum, item) => sum + item.wordCount, 0)
  };
}

export function normalizeExportBatchRequest(request: ExportBatchRequest): ExportBatchRequest {
  assertUniqueChapterNumbers(request.chapterNumbers);

  return {
    ...request,
    chapterNumbers: normalizeChapterNumbers(request.chapterNumbers)
  };
}

export function buildExportPreview(input: {
  request: ExportBatchRequest;
  chapters: ExportChapterSource[];
  exportedAt: string;
}): ExportPreview {
  const request = normalizeExportBatchRequest(input.request);
  const chapterSummaries = buildChapterSummaries(input.chapters);

  if (request.format === 'bundle') {
    return {
      projectId: request.projectId,
      chapterNumbers: request.chapterNumbers,
      format: 'bundle',
      chapterCount: request.chapterNumbers.length,
      files: ['manuscript.md', 'manifest.json', 'chapter-summaries.json'],
      manifest: buildBundleManifest({ request, chapterSummaries, exportedAt: input.exportedAt }),
      chapterSummaries
    };
  }

  return {
    projectId: request.projectId,
    chapterNumbers: request.chapterNumbers,
    format: request.format,
    chapterCount: request.chapterNumbers.length,
    content:
      request.format === 'plain_text'
        ? buildPlainTextContent(input.chapters)
        : buildMarkdownContent(input.chapters),
    chapterSummaries
  };
}

export async function buildGeneratedExport(input: {
  request: ExportBatchRequest;
  chapters: ExportChapterSource[];
  exportedAt: string;
}): Promise<GeneratedExport> {
  const request = normalizeExportBatchRequest(input.request);

  if (request.format === 'plain_text') {
    return {
      fileName: `${request.projectId}-chapters-${request.chapterNumbers.join('-')}.txt`,
      contentType: 'text/plain; charset=utf-8',
      content: buildPlainTextContent(input.chapters),
      kind: 'text'
    };
  }

  if (request.format === 'markdown') {
    return {
      fileName: `${request.projectId}-chapters-${request.chapterNumbers.join('-')}.md`,
      contentType: 'text/markdown; charset=utf-8',
      content: buildMarkdownContent(input.chapters),
      kind: 'text'
    };
  }

  const chapterSummaries = buildChapterSummaries(input.chapters);
  const zip = new JSZip();
  zip.file('manuscript.md', buildMarkdownContent(input.chapters));
  zip.file(
    'manifest.json',
    JSON.stringify(buildBundleManifest({ request, chapterSummaries, exportedAt: input.exportedAt }), null, 2)
  );
  zip.file('chapter-summaries.json', JSON.stringify(chapterSummaries, null, 2));

  return {
    fileName: `${request.projectId}-chapters-${request.chapterNumbers.join('-')}.zip`,
    contentType: 'application/zip',
    content: await zip.generateAsync({ type: 'uint8array' }),
    kind: 'binary'
  };
}
```

```ts
// packages/agent-runtime/src/index.ts
export * from './export-execution';
```

- [ ] **Step 4: Run the runtime tests again**

Run: `corepack pnpm vitest run tests/agent-runtime/export-execution.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
corepack pnpm install
git add packages/agent-runtime/package.json pnpm-lock.yaml packages/agent-runtime/src/export-execution.ts packages/agent-runtime/src/index.ts tests/agent-runtime/export-execution.test.ts
git commit -m "feat: assemble synchronous export outputs"
```

## Task 4: Add Export Execution API Routes

**Files:**
- Create: `apps/api/src/routes/export-execution.ts`
- Modify: `apps/api/src/routes/validation.ts`
- Modify: `apps/api/src/app.ts`
- Test: `tests/api/export-execution.test.ts`

- [ ] **Step 1: Write the failing API tests**

```ts
// tests/api/export-execution.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listExportableChaptersMock = vi.fn();
const loadApprovedChaptersForExportMock = vi.fn();
const buildExportPreviewMock = vi.fn();
const buildGeneratedExportMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/export-execution-repository', () => ({
  ExportExecutionRepository: class {
    listExportableChapters = listExportableChaptersMock;
    loadApprovedChaptersForExport = loadApprovedChaptersForExportMock;
  }
}));

vi.mock('../../packages/agent-runtime/src/export-execution', () => ({
  buildExportPreview: buildExportPreviewMock,
  buildGeneratedExport: buildGeneratedExportMock
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('export execution routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('lists exportable approved chapters', async () => {
    listExportableChaptersMock.mockResolvedValue([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'The trap closes.',
        updatedAt: '2026-04-03T00:00:00.000Z'
      }
    ]);

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/projects/project-1/exportable-chapters'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          projectId: 'project-1',
          chapterNumber: 8,
          title: 'Chapter Eight',
          summary: 'The trap closes.',
          updatedAt: '2026-04-03T00:00:00.000Z'
        }
      ]
    });
    await app.close();
  });

  it('returns a preview payload for a valid export batch', async () => {
    loadApprovedChaptersForExportMock.mockResolvedValue([{ chapterNumber: 8, title: 'Chapter Eight', summary: 'The trap closes.', content: 'Body' }]);
    buildExportPreviewMock.mockReturnValue({
      projectId: 'project-1',
      chapterNumbers: [8],
      format: 'markdown',
      chapterCount: 1,
      content: '# Chapter Eight\n\nBody',
      chapterSummaries: []
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports/preview',
      payload: {
        chapterNumbers: [8],
        format: 'markdown'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      projectId: 'project-1',
      format: 'markdown'
    });
    await app.close();
  });

  it('rejects duplicate chapter numbers with a concrete validation error', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports/preview',
      payload: {
        chapterNumbers: [8, 8],
        format: 'markdown'
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: 'Duplicate chapter numbers are not allowed'
    });
    await app.close();
  });

  it('streams a generated export file for a valid batch', async () => {
    loadApprovedChaptersForExportMock.mockResolvedValue([{ chapterNumber: 8, title: 'Chapter Eight', summary: 'The trap closes.', content: 'Body' }]);
    buildGeneratedExportMock.mockResolvedValue({
      fileName: 'project-1-chapters-8.md',
      contentType: 'text/markdown; charset=utf-8',
      content: '# Chapter Eight\n\nBody',
      kind: 'text'
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports',
      payload: {
        chapterNumbers: [8],
        format: 'markdown'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/markdown');
    expect(response.headers['content-disposition']).toContain('project-1-chapters-8.md');
    await app.close();
  });

  it('returns zip headers for bundle exports', async () => {
    loadApprovedChaptersForExportMock.mockResolvedValue([{ chapterNumber: 8, title: 'Chapter Eight', summary: 'The trap closes.', content: 'Body' }]);
    buildGeneratedExportMock.mockResolvedValue({
      fileName: 'project-1-chapters-8.zip',
      contentType: 'application/zip',
      content: new Uint8Array([1, 2, 3]),
      kind: 'binary'
    });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports',
      payload: {
        chapterNumbers: [8],
        format: 'bundle'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/zip');
    expect(response.headers['content-disposition']).toContain('project-1-chapters-8.zip');
    await app.close();
  });
});
```

- [ ] **Step 2: Run the API tests to verify they fail**

Run: `corepack pnpm vitest run tests/api/export-execution.test.ts`
Expected: FAIL with missing routes or validation helpers

- [ ] **Step 3: Implement the export routes and validation**

```ts
// apps/api/src/routes/validation.ts
export function parseExportBatchPayload(value: unknown):
  | { chapterNumbers: number[]; format: 'plain_text' | 'markdown' | 'bundle' }
  | { error: string } {
  if (!isRecord(value) || !Array.isArray(value.chapterNumbers) || !isString(value.format)) {
    return { error: 'Export batch payload must include chapterNumbers[] and format' };
  }

  if (value.chapterNumbers.length === 0) {
    return { error: 'At least one chapter number is required' };
  }

  if (!value.chapterNumbers.every((chapter) => isNumber(chapter) && chapter >= 1)) {
    return { error: 'Chapter numbers must be positive integers' };
  }

  if (new Set(value.chapterNumbers).size !== value.chapterNumbers.length) {
    return { error: 'Duplicate chapter numbers are not allowed' };
  }

  if (!['plain_text', 'markdown', 'bundle'].includes(value.format)) {
    return { error: `Unsupported export format: ${String(value.format)}` };
  }

  return {
    chapterNumbers: [...value.chapterNumbers].sort((a, b) => a - b),
    format: value.format as 'plain_text' | 'markdown' | 'bundle'
  };
}
```

```ts
// apps/api/src/routes/export-execution.ts
import type { FastifyInstance } from 'fastify';
import {
  buildExportPreview,
  buildGeneratedExport
} from '../../../../packages/agent-runtime/src/export-execution';
import { parseExportBatchPayload } from './validation';

async function getExportExecutionRepository() {
  const { ExportExecutionRepository } = await import(
    '../../../../packages/storage/src/repositories/export-execution-repository'
  );
  return new ExportExecutionRepository();
}

export function registerExportExecutionRoutes(app: FastifyInstance) {
  app.get('/projects/:projectId/exportable-chapters', async (request) => {
    const { projectId } = request.params as { projectId: string };
    const repository = await getExportExecutionRepository();

    return {
      items: await repository.listExportableChapters(projectId)
    };
  });

  app.post('/projects/:projectId/exports/preview', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = parseExportBatchPayload(request.body);

    if ('error' in payload) {
      return reply.code(400).send({ message: payload.error });
    }

    const repository = await getExportExecutionRepository();
    const chapters = await repository.loadApprovedChaptersForExport({ projectId, chapterNumbers: payload.chapterNumbers });

    return reply.code(200).send(
      buildExportPreview({
        request: { projectId, chapterNumbers: payload.chapterNumbers, format: payload.format },
        chapters,
        exportedAt: new Date().toISOString()
      })
    );
  });

  app.post('/projects/:projectId/exports', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const payload = parseExportBatchPayload(request.body);

    if ('error' in payload) {
      return reply.code(400).send({ message: payload.error });
    }

    const repository = await getExportExecutionRepository();
    const chapters = await repository.loadApprovedChaptersForExport({ projectId, chapterNumbers: payload.chapterNumbers });
    const generated = await buildGeneratedExport({
      request: { projectId, chapterNumbers: payload.chapterNumbers, format: payload.format },
      chapters,
      exportedAt: new Date().toISOString()
    });

    return reply
      .code(200)
      .header('content-type', generated.contentType)
      .header('content-disposition', `attachment; filename="${generated.fileName}"`)
      .send(generated.kind === 'text' ? generated.content : Buffer.from(generated.content));
  });
}
```

```ts
// apps/api/src/app.ts
import { registerExportExecutionRoutes } from './routes/export-execution';

registerExportExecutionRoutes(app);
```

- [ ] **Step 4: Run the API tests again**

Run: `corepack pnpm vitest run tests/api/export-execution.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/export-execution.ts apps/api/src/routes/validation.ts apps/api/src/app.ts tests/api/export-execution.test.ts
git commit -m "feat: add export execution api routes"
```

## Task 5: Add Export Batch UI To The Publish Center

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/publish/page.tsx`
- Create: `apps/web/src/app/publish/export/route.ts`
- Modify: `apps/web/src/app/projects/[projectId]/page.tsx`
- Modify: `tests/web/publish-center.test.tsx`
- Create: `tests/web/export-download-route.test.ts`
- Modify: `tests/web/project-detail.test.tsx`

- [ ] **Step 1: Write the failing web tests**

```tsx
// tests/web/publish-center.test.tsx
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PublishCenterPage from '../../apps/web/src/app/publish/page';

describe('PublishCenterPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders export batch controls and markdown preview for the selected project', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              projectId: 'project-1',
              chapterNumber: 8,
              title: 'Chapter Eight',
              summary: 'The trap closes.',
              updatedAt: '2026-04-03T00:00:00.000Z'
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projectId: 'project-1',
          chapterNumbers: [8],
          format: 'markdown',
          chapterCount: 1,
          content: '# Chapter Eight\n\nBody',
          chapterSummaries: []
        })
      });

    const Page = await PublishCenterPage({
      searchParams: Promise.resolve({ projectId: 'project-1', chapterNumbers: ['8'], format: 'markdown', preview: '1' })
    } as never);
    const html = renderToString(Page);

    expect(html).toContain('Publish Center');
    expect(html).toContain('Export Batch');
    expect(html).toContain('Chapter Eight');
    expect(html).toContain('# Chapter Eight');
  });

  it('renders bundle preview metadata for the selected project', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              projectId: 'project-1',
              chapterNumber: 8,
              title: 'Chapter Eight',
              summary: 'The trap closes.',
              updatedAt: '2026-04-03T00:00:00.000Z'
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projectId: 'project-1',
          chapterNumbers: [8],
          format: 'bundle',
          chapterCount: 1,
          files: ['manuscript.md', 'manifest.json', 'chapter-summaries.json'],
          manifest: {
            projectId: 'project-1',
            exportedAt: '2026-04-03T00:00:00.000Z'
          },
          chapterSummaries: [
            {
              chapterNumber: 8,
              title: 'Chapter Eight',
              summary: 'The trap closes.',
              wordCount: 1
            }
          ]
        })
      });

    const Page = await PublishCenterPage({
      searchParams: Promise.resolve({ projectId: 'project-1', chapterNumbers: ['8'], format: 'bundle', preview: '1' })
    } as never);
    const html = renderToString(Page);

    expect(html).toContain('chapter-summaries.json');
    expect(html).toContain('exportedAt');
  });
});
```

```ts
// tests/web/export-download-route.test.ts
import { describe, expect, it, vi } from 'vitest';
import { POST } from '../../apps/web/src/app/publish/export/route';

describe('export download route', () => {
  it('proxies the export request to the API and returns the file response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': 'attachment; filename="project-1-chapters-8.md"'
      }),
      arrayBuffer: async () => new TextEncoder().encode('# Chapter Eight').buffer
    }));

    const formData = new FormData();
    formData.set('projectId', 'project-1');
    formData.set('format', 'markdown');
    formData.append('chapterNumber', '8');

    const response = await POST(new Request('http://localhost/publish/export', {
      method: 'POST',
      body: formData
    }));

    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(response.headers.get('content-disposition')).toContain('project-1-chapters-8.md');
  });
});
```

```tsx
// tests/web/project-detail.test.tsx
expect(html).toContain('/publish?projectId=project-1');
```

- [ ] **Step 2: Run the web tests to verify they fail**

Run: `corepack pnpm vitest run tests/web/publish-center.test.tsx tests/web/export-download-route.test.ts tests/web/project-detail.test.tsx`
Expected: FAIL with missing export controls or route handler

- [ ] **Step 3: Add web API helpers and publish center export UI**

```ts
// apps/web/src/lib/api.ts
export async function getExportableChapters(projectId: string) {
  return getJson<{
    items: Array<{
      projectId: string;
      chapterNumber: number;
      title: string;
      summary: string;
      updatedAt: string;
    }>;
  }>(`${API_BASE_URL}/projects/${projectId}/exportable-chapters`);
}

export async function previewExportBatch(input: {
  projectId: string;
  chapterNumbers: number[];
  format: 'plain_text' | 'markdown' | 'bundle';
}) {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/exports/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chapterNumbers: input.chapterNumbers,
      format: input.format
    })
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}
```

```tsx
// apps/web/src/app/publish/page.tsx
import React from 'react';
import { getExportableChapters, getPublishCenter, previewExportBatch } from '../../lib/api';

function toNumberArray(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

export default async function PublishCenterPage({
  searchParams
}: {
  searchParams?: Promise<{
    projectId?: string;
    chapterNumbers?: string | string[];
    format?: 'plain_text' | 'markdown' | 'bundle';
    preview?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const projectId = params.projectId ?? null;
  const chapterNumbers = toNumberArray(params.chapterNumbers);
  const format = params.format ?? 'markdown';
  const [detail, exportable, preview] = await Promise.all([
    getPublishCenter(),
    projectId ? getExportableChapters(projectId) : Promise.resolve({ items: [] }),
    projectId && params.preview === '1' && chapterNumbers.length > 0
      ? previewExportBatch({ projectId, chapterNumbers, format })
      : Promise.resolve(null)
  ]);

  return (
    <main>
      <h1>Publish Center</h1>
      <section>
        <h2>Export Batch</h2>
        {projectId ? (
          <form action="/publish" method="GET">
            <input type="hidden" name="projectId" value={projectId} />
            <select name="format" defaultValue={format}>
              <option value="plain_text">plain_text</option>
              <option value="markdown">markdown</option>
              <option value="bundle">bundle</option>
            </select>
            {exportable.items.map((item) => (
              <label key={item.chapterNumber}>
                <input
                  type="checkbox"
                  name="chapterNumbers"
                  value={item.chapterNumber}
                  defaultChecked={chapterNumbers.includes(item.chapterNumber)}
                />
                {item.title}
              </label>
            ))}
            <button type="submit" name="preview" value="1">Preview</button>
          </form>
        ) : (
          <p>Select a project from its detail page to export approved chapters.</p>
        )}
      </section>
      {preview ? (
        <section>
          <h2>Preview</h2>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
          <form action="/publish/export" method="POST">
            <input type="hidden" name="projectId" value={projectId ?? ''} />
            <input type="hidden" name="format" value={format} />
            {chapterNumbers.map((chapterNumber) => (
              <input key={chapterNumber} type="hidden" name="chapterNumber" value={chapterNumber} />
            ))}
            <button type="submit">Export</button>
          </form>
        </section>
      ) : null}
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

```ts
// apps/web/src/app/publish/export/route.ts
import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

export async function POST(request: Request) {
  const formData = await request.formData();
  const projectId = String(formData.get('projectId') ?? '');
  const format = String(formData.get('format') ?? 'markdown');
  const chapterNumbers = formData
    .getAll('chapterNumber')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  const upstream = await fetch(`${API_BASE_URL}/projects/${projectId}/exports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chapterNumbers, format })
  });

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': upstream.headers.get('content-disposition') ?? 'attachment'
    }
  });
}
```

```tsx
// apps/web/src/app/projects/[projectId]/page.tsx
<a href={`/publish?projectId=${projectId}`}>Publish Center</a>
```

- [ ] **Step 4: Run the web tests again**

Run: `corepack pnpm vitest run tests/web/publish-center.test.tsx tests/web/export-download-route.test.ts tests/web/project-detail.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/publish/page.tsx apps/web/src/app/publish/export/route.ts apps/web/src/app/projects/[projectId]/page.tsx tests/web/publish-center.test.tsx tests/web/export-download-route.test.ts tests/web/project-detail.test.tsx
git commit -m "feat: add export batch publish center workflow"
```

## Task 6: Add Export Execution Docs, Smoke Coverage, And Final Verification

**Files:**
- Modify: `README.md`
- Create: `tests/e2e/phase-4-export-execution-smoke.test.ts`

- [ ] **Step 1: Write the failing export smoke test**

```ts
// tests/e2e/phase-4-export-execution-smoke.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listExportableChaptersMock = vi.fn();
const loadApprovedChaptersForExportMock = vi.fn();
const buildExportPreviewMock = vi.fn();
const buildGeneratedExportMock = vi.fn();

vi.mock('../../packages/storage/src/repositories/export-execution-repository', () => ({
  ExportExecutionRepository: class {
    listExportableChapters = listExportableChaptersMock;
    loadApprovedChaptersForExport = loadApprovedChaptersForExportMock;
  }
}));

vi.mock('../../packages/agent-runtime/src/export-execution', () => ({
  buildExportPreview: buildExportPreviewMock,
  buildGeneratedExport: buildGeneratedExportMock
}));

async function buildTestApp() {
  const { buildApp } = await import('../../apps/api/src/app');
  return buildApp();
}

describe('phase 4 export execution smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('exposes exportable chapters, preview, and download surfaces', async () => {
    listExportableChaptersMock.mockResolvedValue([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'The trap closes.',
        updatedAt: '2026-04-03T00:00:00.000Z'
      }
    ]);
    loadApprovedChaptersForExportMock.mockResolvedValue([
      {
        projectId: 'project-1',
        chapterNumber: 8,
        title: 'Chapter Eight',
        summary: 'The trap closes.',
        content: 'Body'
      }
    ]);
    buildExportPreviewMock.mockReturnValue({
      projectId: 'project-1',
      chapterNumbers: [8],
      format: 'markdown',
      chapterCount: 1,
      content: '# Chapter Eight\n\nBody',
      chapterSummaries: []
    });
    buildGeneratedExportMock.mockResolvedValue({
      fileName: 'project-1-chapters-8.md',
      contentType: 'text/markdown; charset=utf-8',
      content: '# Chapter Eight\n\nBody',
      kind: 'text'
    });

    const app = await buildTestApp();

    const chapters = await app.inject({ method: 'GET', url: '/projects/project-1/exportable-chapters' });
    const preview = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports/preview',
      payload: { chapterNumbers: [8], format: 'markdown' }
    });
    const download = await app.inject({
      method: 'POST',
      url: '/projects/project-1/exports',
      payload: { chapterNumbers: [8], format: 'markdown' }
    });

    expect(chapters.statusCode).toBe(200);
    expect(preview.statusCode).toBe(200);
    expect(download.statusCode).toBe(200);

    await app.close();
  });
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `corepack pnpm vitest run tests/e2e/phase-4-export-execution-smoke.test.ts`
Expected: FAIL with missing export execution routes

- [ ] **Step 3: Update README and finalize smoke coverage**

```md
## Phase 4 Expected Behavior

- blocked review outcomes open a real multi-turn decision session
- decision-session messages persist and can generate structured draft resolutions
- confirmed resolutions can define a dynamic replan window
- recovery tasks can invalidate existing plans and resume from a specific chapter
- approved chapters can be batch-exported from the control panel as plain_text, markdown, or bundle outputs
```

- [ ] **Step 4: Run the focused export execution suite**

Run: `corepack pnpm vitest run tests/storage/phase-4-export-execution-types.test.ts tests/storage/export-execution-repository.test.ts tests/agent-runtime/export-execution.test.ts tests/api/export-execution.test.ts tests/web/publish-center.test.tsx tests/web/export-download-route.test.ts tests/web/project-detail.test.tsx tests/e2e/phase-4-export-execution-smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full regression suite**

Run: `corepack pnpm vitest run tests/workspace tests/storage tests/llm-gateway tests/agent-runtime tests/api tests/workflows tests/web tests/e2e`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md tests/e2e/phase-4-export-execution-smoke.test.ts
git commit -m "docs: add export execution smoke coverage"
```

## Self-Review

### Spec coverage

- approved-only export source: covered by Task 2 and Task 4
- batch multi-select request / preview / synchronous download: covered by Task 1, Task 3, Task 4, and Task 5
- `plain_text` / `markdown` single-file export and `bundle` zip export: covered by Task 3
- publish-center preview and download UX: covered by Task 5
- no export history and no real platform publishing: enforced by the file structure and task scope
- duplicate or invalid chapter selections are rejected instead of silently normalized away: covered by Task 3 and Task 4
- preview/export manifest consistency, concrete validation errors, and bundle-specific headers / summary preview: covered by Task 3, Task 4, and Task 5
- docs, smoke, and full regression: covered by Task 6

### Placeholder scan

- No `TODO`, `TBD`, or “similar to Task N” placeholders remain.
- Every task includes concrete file paths, code snippets, commands, and commit messages.
- API and web tasks specify exact route names and response shapes.
- Workspace dependency updates explicitly include `pnpm-lock.yaml`.

### Type consistency

- `ExportBatchRequest`, `ExportPreview`, `GeneratedExport`, and `ExportableChapter` are introduced once in Task 1 and reused consistently.
- Export route names are consistent between Task 4, Task 5, and Task 6.
- `plain_text`, `markdown`, and `bundle` are used consistently across domain, runtime, API, and web tasks.
- `bundle` preview and download both use the same manifest shape in Task 3.
