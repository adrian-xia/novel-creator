import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  storyState: {
    upsert: vi.fn()
  },
  outlineRecord: {
    create: vi.fn()
  },
  volumePlanRecord: {
    createMany: vi.fn()
  },
  chapterPlanRecord: {
    create: vi.fn()
  },
  chapterDraftRecord: {
    create: vi.fn()
  },
  reviewOutcomeRecord: {
    create: vi.fn()
  },
  agentRunRecord: {
    create: vi.fn()
  }
}));

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('StoryStateRepository', () => {
  beforeEach(() => {
    Object.values(prisma).forEach((model) => {
      Object.values(model).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          fn.mockReset();
        }
      });
    });
  });

  it('persists outline and story state in one method call', async () => {
    prisma.outlineRecord.create.mockResolvedValue({ id: 'outline-1' });
    prisma.storyState.upsert.mockResolvedValue({ projectId: 'project-1' });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await repository.saveOutline({
      projectId: 'project-1',
      outline: { title: '总纲', ending: '收束' },
      storyBible: '江湖与仙门并存'
    });

    expect(prisma.outlineRecord.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-1',
        payload: { title: '总纲', ending: '收束' }
      }
    });
    expect(prisma.storyState.upsert).toHaveBeenCalled();
  });

  it('appends approved chapter summaries back into story state', async () => {
    prisma.storyState.upsert.mockResolvedValue({ projectId: 'project-1' });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await repository.saveApprovedChapterSummary({
      projectId: 'project-1',
      chapterNumber: 2,
      summary: '主角确认师门内鬼，决定反查账册',
      nextChapterNumber: 3
    });

    expect(prisma.storyState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          chapterSummaries: expect.anything(),
          currentPosition: { nextChapterNumber: 3, currentVolumeNumber: null }
        })
      })
    );
  });
});
