import type { ExportableChapter } from '@novel-creator/domain';
import { prisma } from '../client';

type ChapterStateRecord = {
  projectId: string;
  chapterNumber: number;
  status: string;
  updatedAt: Date;
};

type ChapterDraftRecord = {
  projectId: string;
  chapterNumber: number;
  version: number;
  content: string | null;
  summary: string | null;
};

type ChapterPlanRecord = {
  projectId: string;
  chapterNumber: number;
  invalidatedAt: Date | null;
  createdAt: Date;
  payload: unknown;
};

function getChapterTitle(payload: unknown, chapterNumber: number) {
  if (payload && typeof payload === 'object') {
    const title = (payload as { title?: unknown }).title;
    if (typeof title === 'string') {
      return title;
    }
  }

  return `Chapter ${chapterNumber}`;
}

function indexByChapter<T extends { chapterNumber: number }>(records: T[]) {
  const byChapter = new Map<number, T>();

  for (const record of records) {
    byChapter.set(record.chapterNumber, record);
  }

  return byChapter;
}

function indexLatestByChapter<T extends { chapterNumber: number }>(records: T[]) {
  const latestByChapter = new Map<number, T>();

  for (const record of records) {
    if (!latestByChapter.has(record.chapterNumber)) {
      latestByChapter.set(record.chapterNumber, record);
    }
  }

  return latestByChapter;
}

function sortChapterNumbers(chapterNumbers: number[]) {
  return [...chapterNumbers].sort((left, right) => left - right);
}

function sortDrafts(records: ChapterDraftRecord[]) {
  return [...records].sort((left, right) => {
    if (left.chapterNumber !== right.chapterNumber) {
      return left.chapterNumber - right.chapterNumber;
    }

    return right.version - left.version;
  });
}

function sortPlans(records: ChapterPlanRecord[]) {
  return [...records].sort((left, right) => {
    if (left.chapterNumber !== right.chapterNumber) {
      return left.chapterNumber - right.chapterNumber;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

export class ExportExecutionRepository {
  async listExportableChapters(projectId: string): Promise<ExportableChapter[]> {
    const approvedStates = (await prisma.chapterStateRecord.findMany({
      where: { projectId, status: 'approved' },
      orderBy: { chapterNumber: 'asc' }
    })) as ChapterStateRecord[];

    const chapterNumbers = sortChapterNumbers(approvedStates.map((state) => state.chapterNumber));

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

    const approvedStateByChapter = indexByChapter(approvedStates);
    const latestDraftByChapter = indexLatestByChapter(sortDrafts(drafts as ChapterDraftRecord[]));
    const latestPlanByChapter = indexLatestByChapter(sortPlans(plans as ChapterPlanRecord[]));

    return chapterNumbers.map((chapterNumber) => {
      const draft = latestDraftByChapter.get(chapterNumber);
      if (!draft || !draft.summary) {
        throw new Error(`Approved chapter ${chapterNumber} is missing export summary`);
      }

      return {
        projectId,
        chapterNumber,
        title: getChapterTitle(latestPlanByChapter.get(chapterNumber)?.payload, chapterNumber),
        summary: draft.summary,
        updatedAt: approvedStateByChapter.get(chapterNumber)?.updatedAt.toISOString() ?? ''
      };
    });
  }

  async loadApprovedChaptersForExport(input: { projectId: string; chapterNumbers: number[] }) {
    const chapterNumbers = sortChapterNumbers(input.chapterNumbers);
    const approvedStates = (await prisma.chapterStateRecord.findMany({
      where: {
        projectId: input.projectId,
        chapterNumber: { in: chapterNumbers },
        status: 'approved'
      },
      orderBy: { chapterNumber: 'asc' }
    })) as ChapterStateRecord[];

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

    const latestDraftByChapter = indexLatestByChapter(sortDrafts(drafts as ChapterDraftRecord[]));
    const latestPlanByChapter = indexLatestByChapter(sortPlans(plans as ChapterPlanRecord[]));

    return chapterNumbers.map((chapterNumber) => {
      const draft = latestDraftByChapter.get(chapterNumber);
      if (!draft || !draft.summary || !draft.content) {
        throw new Error(`Approved chapter ${chapterNumber} is missing export content`);
      }

      return {
        projectId: input.projectId,
        chapterNumber,
        title: getChapterTitle(latestPlanByChapter.get(chapterNumber)?.payload, chapterNumber),
        summary: draft.summary,
        content: draft.content
      };
    });
  }
}
