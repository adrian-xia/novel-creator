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
    create: vi.fn(),
    updateMany: vi.fn()
  },
  chapterDraftRecord: {
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn()
  },
  reviewOutcomeRecord: {
    create: vi.fn()
  },
  agentRunRecord: {
    create: vi.fn()
  }
}));

vi.mock('@prisma/client', () => ({
  Prisma: {
    TransactionIsolationLevel: {
      Serializable: 'Serializable'
    }
  }
}));

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('StoryStateRepository', () => {
  beforeEach(() => {
    vi.resetModules();
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
    expect(prisma.storyState.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: {
        projectId: 'project-1',
        storyBible: '江湖与仙门并存',
        outline: { title: '总纲', ending: '收束' },
        volumePlans: [],
        confirmedFacts: [],
        openForeshadowing: [],
        chapterSummaries: [],
        currentPosition: { nextChapterNumber: 1, currentVolumeNumber: null }
      },
      update: {
        storyBible: '江湖与仙门并存',
        outline: { title: '总纲', ending: '收束' }
      }
    });
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
    expect(prisma.storyState.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: {
        projectId: 'project-1',
        storyBible: null,
        outline: null,
        volumePlans: [{ name: '第一卷' }, { name: '第二卷' }],
        confirmedFacts: [],
        openForeshadowing: [],
        chapterSummaries: [],
        currentPosition: { nextChapterNumber: 1, currentVolumeNumber: 1 }
      },
      update: {
        volumePlans: [{ name: '第一卷' }, { name: '第二卷' }],
        currentPosition: { nextChapterNumber: 1, currentVolumeNumber: 1 }
      }
    });
  });

  it('preserves validated volume numbers when persisting volume plans', async () => {
    prisma.volumePlanRecord.createMany.mockResolvedValue({ count: 2 });
    prisma.storyState.upsert.mockResolvedValue({ projectId: 'project-1' });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await repository.saveVolumePlans({
      projectId: 'project-1',
      plans: [
        { volumeNumber: 3, name: '第三卷' },
        { volumeNumber: 4, name: '第四卷' }
      ]
    });

    expect(prisma.volumePlanRecord.createMany).toHaveBeenCalledWith({
      data: [
        { projectId: 'project-1', volumeNumber: 3, payload: { volumeNumber: 3, name: '第三卷' } },
        { projectId: 'project-1', volumeNumber: 4, payload: { volumeNumber: 4, name: '第四卷' } }
      ]
    });
    expect(prisma.storyState.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: {
        projectId: 'project-1',
        storyBible: null,
        outline: null,
        volumePlans: [
          { volumeNumber: 3, name: '第三卷' },
          { volumeNumber: 4, name: '第四卷' }
        ],
        confirmedFacts: [],
        openForeshadowing: [],
        chapterSummaries: [],
        currentPosition: { nextChapterNumber: 1, currentVolumeNumber: 3 }
      },
      update: {
        volumePlans: [
          { volumeNumber: 3, name: '第三卷' },
          { volumeNumber: 4, name: '第四卷' }
        ],
        currentPosition: { nextChapterNumber: 1, currentVolumeNumber: 3 }
      }
    });
  });

  it('allocates the next chapter number from story state current position', async () => {
    prisma.storyState.findUnique.mockResolvedValue({
      projectId: 'project-1',
      currentPosition: { nextChapterNumber: 8, currentVolumeNumber: 2 }
    });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await expect(repository.getNextChapterNumber('project-1')).resolves.toBe(8);
    expect(prisma.storyState.findUnique).toHaveBeenCalledWith({
      where: { projectId: 'project-1' }
    });
  });

  it('invalidates chapter plans within a replan window', async () => {
    prisma.chapterPlanRecord.updateMany.mockResolvedValue({ count: 3 });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await repository.invalidateChapterPlansInRange({
      projectId: 'project-1',
      startChapter: 8,
      endChapter: 10
    });

    expect(prisma.chapterPlanRecord.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        chapterNumber: {
          gte: 8,
          lte: 10
        }
      },
      data: {
        invalidatedAt: expect.any(Date)
      }
    });
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

  it('upserts chapter drafts by project, chapter, and version', async () => {
    prisma.chapterDraftRecord.upsert.mockResolvedValue({
      projectId: 'project-1',
      chapterNumber: 8,
      version: 1
    });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await repository.saveChapterDraft({
      projectId: 'project-1',
      chapterNumber: 8,
      version: 1,
      content: '第八章正文',
      summary: null,
      metadata: {}
    });

    expect(prisma.chapterDraftRecord.upsert).toHaveBeenCalledWith({
      where: {
        projectId_chapterNumber_version: {
          projectId: 'project-1',
          chapterNumber: 8,
          version: 1
        }
      },
      create: {
        projectId: 'project-1',
        chapterNumber: 8,
        version: 1,
        content: '第八章正文',
        summary: null,
        metadata: {}
      },
      update: {
        content: '第八章正文',
        summary: null,
        metadata: {}
      }
    });
  });

  it('loads the latest chapter draft by descending version', async () => {
    prisma.chapterDraftRecord.findFirst.mockResolvedValue({
      projectId: 'project-1',
      chapterNumber: 8,
      version: 3,
      content: '第三版正文'
    });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await expect(repository.getLatestChapterDraft('project-1', 8)).resolves.toEqual({
      projectId: 'project-1',
      chapterNumber: 8,
      version: 3,
      content: '第三版正文'
    });
    expect(prisma.chapterDraftRecord.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'project-1', chapterNumber: 8 },
      orderBy: [{ version: 'desc' }]
    });
  });

  it('marks a replan window as needs_replan chapter states', async () => {
    prisma.chapterStateRecord.upsert.mockResolvedValue({
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'needs_replan'
    });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await repository.markChaptersNeedsReplan({
      projectId: 'project-1',
      startChapter: 8,
      endChapter: 10
    });

    expect(prisma.chapterStateRecord.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.chapterStateRecord.upsert).toHaveBeenNthCalledWith(1, {
      where: {
        projectId_chapterNumber: {
          projectId: 'project-1',
          chapterNumber: 8
        }
      },
      create: {
        projectId: 'project-1',
        chapterNumber: 8,
        status: 'needs_replan'
      },
      update: {
        status: 'needs_replan'
      }
    });
    expect(prisma.chapterStateRecord.upsert).toHaveBeenNthCalledWith(3, {
      where: {
        projectId_chapterNumber: {
          projectId: 'project-1',
          chapterNumber: 10
        }
      },
      create: {
        projectId: 'project-1',
        chapterNumber: 10,
        status: 'needs_replan'
      },
      update: {
        status: 'needs_replan'
      }
    });
  });

  it('persists workflow-decided chapter state through the chapter state helper', async () => {
    prisma.chapterStateRecord.upsert.mockResolvedValue({
      projectId: 'project-1',
      chapterNumber: 7,
      status: 'blocked_for_manual_decision'
    });

    const { StoryStateRepository } = await import(
      '../../packages/storage/src/repositories/story-state-repository'
    );
    const repository = new StoryStateRepository();

    await repository.saveWorkflowDecidedChapterState({
      projectId: 'project-1',
      chapterNumber: 7,
      chapterState: 'blocked_for_manual_decision'
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
        status: 'blocked_for_manual_decision'
      },
      update: {
        status: 'blocked_for_manual_decision'
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
