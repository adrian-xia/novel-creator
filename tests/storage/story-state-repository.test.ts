import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  chapterStateRecord: {
    upsert: vi.fn()
  },
  storyState: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
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
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma)
    );

    Object.values(prisma).forEach((model) => {
      if (typeof model === 'function') {
        return;
      }

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
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prisma.storyState.upsert).toHaveBeenCalled();
  });

  it('persists volume plans and story state in one transaction', async () => {
    prisma.volumePlanRecord.createMany.mockResolvedValue({ count: 2 });
    prisma.storyState.upsert.mockResolvedValue({ projectId: 'project-1' });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await repository.saveVolumePlans({
      projectId: 'project-1',
      plans: [{ name: '第一卷' }, { name: '第二卷' }]
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prisma.volumePlanRecord.createMany).toHaveBeenCalledWith({
      data: [
        { projectId: 'project-1', volumeNumber: 1, payload: { name: '第一卷' } },
        { projectId: 'project-1', volumeNumber: 2, payload: { name: '第二卷' } }
      ]
    });
    expect(prisma.storyState.upsert).toHaveBeenCalled();
  });

  it('upserts persisted chapter state by project and chapter number', async () => {
    prisma.chapterStateRecord.upsert.mockResolvedValue({
      projectId: 'project-1',
      chapterNumber: 7,
      status: 'drafted'
    });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await repository.saveChapterState({
      projectId: 'project-1',
      chapterNumber: 7,
      status: 'drafted'
    });

    expect(prisma.chapterStateRecord.upsert).toHaveBeenCalledWith({
      where: {
        projectId_chapterNumber: {
          projectId: 'project-1',
          chapterNumber: 7
        }
      },
      create: {
        projectId: 'project-1',
        chapterNumber: 7,
        status: 'drafted'
      },
      update: {
        status: 'drafted'
      }
    });
  });

  it('creates chapter summaries inside a transaction when story state is missing', async () => {
    prisma.storyState.findUnique.mockResolvedValue(null);
    prisma.storyState.create.mockResolvedValue({ projectId: 'project-1' });

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

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: expect.anything() })
    );
    expect(prisma.storyState.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-1',
        storyBible: null,
        outline: null,
        volumePlans: [],
        confirmedFacts: [],
        openForeshadowing: [],
        chapterSummaries: [{ chapterNumber: 2, summary: '主角确认师门内鬼，决定反查账册' }],
        currentPosition: { nextChapterNumber: 3, currentVolumeNumber: null }
      }
    });
  });

  it('appends approved chapter summaries and preserves current volume number', async () => {
    prisma.storyState.findUnique.mockResolvedValue({
      projectId: 'project-1',
      chapterSummaries: [{ chapterNumber: 1, summary: '前情提要' }],
      currentPosition: { nextChapterNumber: 2, currentVolumeNumber: 4 }
    });
    prisma.storyState.update.mockResolvedValue({ projectId: 'project-1' });

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

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: expect.anything() })
    );
    expect(prisma.storyState.update).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      data: expect.objectContaining({
        chapterSummaries: [
          { chapterNumber: 1, summary: '前情提要' },
          { chapterNumber: 2, summary: '主角确认师门内鬼，决定反查账册' }
        ],
        currentPosition: { nextChapterNumber: 3, currentVolumeNumber: 4 }
      })
    });
  });
});
