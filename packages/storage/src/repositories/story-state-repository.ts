import type {
  AgentRun,
  ChapterDraft,
  ChapterPlan,
  ChapterState,
  ReviewOutcome
} from '@novel-creator/domain';
import { prisma } from '../client';

const SERIALIZABLE_ISOLATION_LEVEL = 'Serializable' as const;

function resolveVolumeNumber(payload: Record<string, unknown>, fallback: number) {
  return Number.isInteger(payload.volumeNumber) && payload.volumeNumber > 0
    ? (payload.volumeNumber as number)
    : fallback;
}

export class StoryStateRepository {
  async getStoryState(projectId: string) {
    return prisma.storyState.findUnique({
      where: { projectId }
    });
  }

  async getNextChapterNumber(projectId: string) {
    const state = await this.getStoryState(projectId);
    const nextChapterNumber = state?.currentPosition?.nextChapterNumber;

    if (typeof nextChapterNumber !== 'number') {
      throw new Error(`Story state is not ready for next chapter generation: ${projectId}`);
    }

    return nextChapterNumber;
  }

  async saveOutline(input: {
    projectId: string;
    outline: Record<string, unknown>;
    storyBible: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.outlineRecord.create({
        data: {
          projectId: input.projectId,
          payload: input.outline
        }
      });

      return tx.storyState.upsert({
        where: { projectId: input.projectId },
        create: {
          projectId: input.projectId,
          storyBible: input.storyBible,
          outline: input.outline,
          volumePlans: [],
          confirmedFacts: [],
          openForeshadowing: [],
          chapterSummaries: [],
          currentPosition: { nextChapterNumber: 1, currentVolumeNumber: null }
        },
        update: {
          storyBible: input.storyBible,
          outline: input.outline
        }
      });
    });
  }

  async saveVolumePlans(input: { projectId: string; plans: Array<Record<string, unknown>> }) {
    const currentVolumeNumber =
      input.plans.length > 0 ? resolveVolumeNumber(input.plans[0] ?? {}, 1) : null;

    return prisma.$transaction(async (tx) => {
      await tx.volumePlanRecord.createMany({
        data: input.plans.map((payload, index) => ({
          projectId: input.projectId,
          volumeNumber: resolveVolumeNumber(payload, index + 1),
          payload
        }))
      });

      return tx.storyState.upsert({
        where: { projectId: input.projectId },
        create: {
          projectId: input.projectId,
          storyBible: null,
          outline: null,
          volumePlans: input.plans,
          confirmedFacts: [],
          openForeshadowing: [],
          chapterSummaries: [],
          currentPosition: { nextChapterNumber: 1, currentVolumeNumber }
        },
        update: {
          volumePlans: input.plans,
          currentPosition: { nextChapterNumber: 1, currentVolumeNumber }
        }
      });
    });
  }

  async saveChapterPlan(plan: ChapterPlan) {
    return prisma.chapterPlanRecord.create({
      data: {
        projectId: plan.projectId,
        chapterNumber: plan.chapterNumber,
        payload: plan
      }
    });
  }

  async invalidateChapterPlansInRange(input: {
    projectId: string;
    startChapter: number;
    endChapter: number;
  }) {
    return prisma.chapterPlanRecord.updateMany({
      where: {
        projectId: input.projectId,
        chapterNumber: {
          gte: input.startChapter,
          lte: input.endChapter
        }
      },
      data: {
        invalidatedAt: new Date()
      }
    });
  }

  async saveChapterDraft(draft: ChapterDraft) {
    return prisma.chapterDraftRecord.upsert({
      where: {
        projectId_chapterNumber_version: {
          projectId: draft.projectId,
          chapterNumber: draft.chapterNumber,
          version: draft.version
        }
      },
      create: {
        projectId: draft.projectId,
        chapterNumber: draft.chapterNumber,
        version: draft.version,
        content: draft.content,
        summary: draft.summary,
        metadata: draft.metadata
      },
      update: {
        content: draft.content,
        summary: draft.summary,
        metadata: draft.metadata
      }
    });
  }

  async getLatestChapterDraft(projectId: string, chapterNumber: number) {
    return prisma.chapterDraftRecord.findFirst({
      where: { projectId, chapterNumber },
      orderBy: [{ version: 'desc' }]
    });
  }

  async saveChapterState(input: {
    projectId: string;
    chapterNumber: number;
    status: ChapterState;
  }) {
    return prisma.chapterStateRecord.upsert({
      where: {
        projectId_chapterNumber: {
          projectId: input.projectId,
          chapterNumber: input.chapterNumber
        }
      },
      create: {
        projectId: input.projectId,
        chapterNumber: input.chapterNumber,
        status: input.status
      },
      update: {
        status: input.status
      }
    });
  }

  async saveWorkflowDecidedChapterState(input: {
    projectId: string;
    chapterNumber: number;
    chapterState: ChapterState;
  }) {
    return this.saveChapterState({
      projectId: input.projectId,
      chapterNumber: input.chapterNumber,
      status: input.chapterState
    });
  }

  async markChapterBlockedForDecision(input: { projectId: string; chapterNumber: number }) {
    return this.saveChapterState({
      projectId: input.projectId,
      chapterNumber: input.chapterNumber,
      status: 'blocked_for_manual_decision'
    });
  }

  async markChaptersNeedsReplan(input: {
    projectId: string;
    startChapter: number;
    endChapter: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const updates = [];

      for (let chapterNumber = input.startChapter; chapterNumber <= input.endChapter; chapterNumber += 1) {
        updates.push(tx.chapterStateRecord.upsert({
          where: {
            projectId_chapterNumber: {
              projectId: input.projectId,
              chapterNumber
            }
          },
          create: {
            projectId: input.projectId,
            chapterNumber,
            status: 'needs_replan'
          },
          update: {
            status: 'needs_replan'
          }
        }));
      }

      return Promise.all(updates);
    });
  }

  async saveReviewOutcome(outcome: ReviewOutcome) {
    return prisma.reviewOutcomeRecord.create({
      data: {
        projectId: outcome.projectId,
        chapterNumber: outcome.chapterNumber,
        payload: outcome
      }
    });
  }

  async saveAgentRun(run: AgentRun) {
    return prisma.agentRunRecord.create({
      data: run
    });
  }

  async saveApprovedChapterSummary(input: {
    projectId: string;
    chapterNumber: number;
    summary: string;
    nextChapterNumber: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const nextSummary = {
        chapterNumber: input.chapterNumber,
        summary: input.summary
      };
      const existingState = await tx.storyState.findUnique({
        where: { projectId: input.projectId }
      });
      const currentVolumeNumber =
        existingState &&
        existingState.currentPosition &&
        typeof existingState.currentPosition === 'object' &&
        'currentVolumeNumber' in existingState.currentPosition
          ? existingState.currentPosition.currentVolumeNumber
          : null;
      const currentPosition = {
        nextChapterNumber: input.nextChapterNumber,
        currentVolumeNumber
      };

      if (!existingState) {
        return tx.storyState.create({
          data: {
            projectId: input.projectId,
            storyBible: null,
            outline: null,
            volumePlans: [],
            confirmedFacts: [],
            openForeshadowing: [],
            chapterSummaries: [nextSummary],
            currentPosition
          }
        });
      }

      const chapterSummaries = Array.isArray(existingState.chapterSummaries)
        ? [...existingState.chapterSummaries, nextSummary]
        : [nextSummary];

      return tx.storyState.update({
        where: { projectId: input.projectId },
        data: {
          chapterSummaries,
          currentPosition
        }
      });
    }, {
      isolationLevel: SERIALIZABLE_ISOLATION_LEVEL
    });
  }
}
