import type { AgentRun, ChapterDraft, ChapterPlan, ReviewOutcome } from '@novel-creator/domain';
import { prisma } from '../client';

export class StoryStateRepository {
  async saveOutline(input: {
    projectId: string;
    outline: Record<string, unknown>;
    storyBible: string | null;
  }) {
    await prisma.outlineRecord.create({
      data: {
        projectId: input.projectId,
        payload: input.outline
      }
    });

    return prisma.storyState.upsert({
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
  }

  async saveVolumePlans(input: { projectId: string; plans: Array<Record<string, unknown>> }) {
    await prisma.volumePlanRecord.createMany({
      data: input.plans.map((payload, index) => ({
        projectId: input.projectId,
        volumeNumber: index + 1,
        payload
      }))
    });

    return prisma.storyState.upsert({
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
    return prisma.storyState.upsert({
      where: { projectId: input.projectId },
      create: {
        projectId: input.projectId,
        storyBible: null,
        outline: null,
        volumePlans: [],
        confirmedFacts: [],
        openForeshadowing: [],
        chapterSummaries: [{ chapterNumber: input.chapterNumber, summary: input.summary }],
        currentPosition: { nextChapterNumber: input.nextChapterNumber, currentVolumeNumber: null }
      },
      update: {
        chapterSummaries: {
          push: { chapterNumber: input.chapterNumber, summary: input.summary }
        },
        currentPosition: { nextChapterNumber: input.nextChapterNumber, currentVolumeNumber: null }
      }
    });
  }
}
