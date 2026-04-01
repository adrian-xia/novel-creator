import { Prisma } from '@prisma/client';
import type {
  AgentRun,
  ChapterDraft,
  ChapterPlan,
  ChapterState,
  ReviewOutcome
} from '@novel-creator/domain';
import { prisma } from '../client';

export class StoryStateRepository {
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
    return prisma.$transaction(async (tx) => {
      await tx.volumePlanRecord.createMany({
        data: input.plans.map((payload, index) => ({
          projectId: input.projectId,
          volumeNumber: index + 1,
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
          currentPosition: { nextChapterNumber: 1, currentVolumeNumber: 1 }
        },
        update: {
          volumePlans: input.plans,
          currentPosition: { nextChapterNumber: 1, currentVolumeNumber: 1 }
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

  async saveChapterDraft(draft: ChapterDraft) {
    return prisma.chapterDraftRecord.create({
      data: {
        projectId: draft.projectId,
        chapterNumber: draft.chapterNumber,
        version: draft.version,
        content: draft.content,
        summary: draft.summary,
        metadata: draft.metadata
      }
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
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }
}
