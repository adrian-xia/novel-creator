import { describe, expect, it, vi } from 'vitest';

describe('chapter executors', () => {
  it('fails when a project chapter pipeline lock is already held', async () => {
    const { acquireChapterPipelineLock, releaseChapterPipelineLock } = await import(
      '../../packages/workflows/src/chapter-lock'
    );

    await acquireChapterPipelineLock('project-1');

    await expect(acquireChapterPipelineLock('project-1')).rejects.toThrow(
      'Project chapter pipeline already active for project-1'
    );

    await releaseChapterPipelineLock('project-1');
  });

  it('writes a chapter plan, draft, and drafted state', async () => {
    const { executeGenerateChapter } = await import(
      '../../packages/workflows/src/chapter-executors'
    );
    const saveChapterPlan = vi.fn().mockResolvedValue(undefined);
    const saveChapterDraft = vi.fn().mockResolvedValue(undefined);
    const saveChapterState = vi.fn().mockResolvedValue(undefined);
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        rawOutput:
          '{"title":"第八章 夜探藏书阁","goal":"确认郡守幕僚身份","beats":["潜入","试探"],"povCharacter":"陆临"}',
        parsedOutput: null,
        tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
      })
      .mockResolvedValueOnce({
        rawOutput: '第八章正文',
        parsedOutput: null,
        tokenUsage: { promptTokens: 12, completionTokens: 40, totalTokens: 52 }
      });
    const deps = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.4',
      agentRunner: { run },
      promptRepository: {
        findLatestEnabledByAgentName: vi
          .fn()
          .mockResolvedValueOnce({
            agentName: 'chapter-plan-agent',
            version: 2,
            systemPrompt: 'You are the chapter planner.',
            taskTemplate: 'Plan the next chapter.'
          })
          .mockResolvedValueOnce({
            agentName: 'chapter-draft-agent',
            version: 5,
            systemPrompt: 'You are the chapter drafter.',
            taskTemplate: 'Draft the approved chapter plan.'
          })
      },
      storyStateRepository: {
        getStoryState: vi.fn().mockResolvedValue({
          projectId: 'project-1',
          volumePlans: [{ volumeNumber: 2, goal: '郡城迷局' }],
          confirmedFacts: ['郡守三日后设宴'],
          openForeshadowing: ['黑伞客身份未明'],
          chapterSummaries: [
            { chapterNumber: 6, summary: '查到旧账册缺页。' },
            { chapterNumber: 7, summary: '锁定幕僚夜行踪迹。' }
          ],
          currentPosition: { nextChapterNumber: 8, currentVolumeNumber: 2 }
        }),
        getNextChapterNumber: vi.fn().mockResolvedValue(8),
        invalidateChapterPlansInRange: vi.fn().mockResolvedValue({ count: 0 }),
        saveChapterPlan,
        saveChapterDraft,
        saveChapterState
      }
    };

    await expect(
      executeGenerateChapter(
        { projectId: 'project-1', chapterNumber: null },
        deps
      )
    ).resolves.toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        chapterNumber: 8
      })
    );

    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        agentType: 'chapter-plan-agent',
        chapterNumber: 8,
        provider: 'openai',
        model: 'gpt-5.4'
      })
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        agentType: 'chapter-draft-agent',
        chapterNumber: 8,
        provider: 'openai',
        model: 'gpt-5.4',
        inputSnapshot: expect.not.objectContaining({
          fullTextHistory: expect.anything()
        })
      })
    );
    expect(saveChapterPlan).toHaveBeenCalledWith({
      projectId: 'project-1',
      chapterNumber: 8,
      title: '第八章 夜探藏书阁',
      goal: '确认郡守幕僚身份',
      beats: ['潜入', '试探'],
      povCharacter: '陆临',
      hardConstraints: []
    });
    expect(deps.storyStateRepository.invalidateChapterPlansInRange).toHaveBeenCalledWith({
      projectId: 'project-1',
      startChapter: 8,
      endChapter: 8
    });
    expect(saveChapterDraft).toHaveBeenCalledWith({
      projectId: 'project-1',
      chapterNumber: 8,
      version: 1,
      content: '第八章正文',
      summary: null,
      metadata: {}
    });
    expect(saveChapterState).toHaveBeenNthCalledWith(1, {
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'planned'
    });
    expect(saveChapterState).toHaveBeenNthCalledWith(2, {
      projectId: 'project-1',
      chapterNumber: 8,
      status: 'drafted'
    });

    const { acquireChapterPipelineLock, releaseChapterPipelineLock } = await import(
      '../../packages/workflows/src/chapter-lock'
    );
    await expect(acquireChapterPipelineLock('project-1')).resolves.toBeUndefined();
    await releaseChapterPipelineLock('project-1');
  });

  it('releases the project lock when chapter generation fails', async () => {
    const { executeGenerateChapter } = await import(
      '../../packages/workflows/src/chapter-executors'
    );
    const deps = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.4',
      agentRunner: { run: vi.fn() },
      promptRepository: {
        findLatestEnabledByAgentName: vi.fn().mockResolvedValue(null)
      },
      storyStateRepository: {
        getStoryState: vi.fn().mockResolvedValue({
          projectId: 'project-1',
          volumePlans: [{ volumeNumber: 2, goal: '郡城迷局' }],
          confirmedFacts: [],
          openForeshadowing: [],
          chapterSummaries: [],
          currentPosition: { nextChapterNumber: 8, currentVolumeNumber: 2 }
        }),
        getNextChapterNumber: vi.fn().mockResolvedValue(8),
        invalidateChapterPlansInRange: vi.fn(),
        saveChapterPlan: vi.fn(),
        saveChapterDraft: vi.fn(),
        saveChapterState: vi.fn()
      }
    };

    await expect(
      executeGenerateChapter(
        { projectId: 'project-1', chapterNumber: null },
        deps
      )
    ).rejects.toThrow('Prompt config not found for chapter-plan-agent');

    const { acquireChapterPipelineLock, releaseChapterPipelineLock } = await import(
      '../../packages/workflows/src/chapter-lock'
    );
    await expect(acquireChapterPipelineLock('project-1')).resolves.toBeUndefined();
    await releaseChapterPipelineLock('project-1');
  });

  it('fails when chapter generation starts before volume plans exist', async () => {
    const { executeGenerateChapter } = await import(
      '../../packages/workflows/src/chapter-executors'
    );

    await expect(
      executeGenerateChapter(
        { projectId: 'project-1', chapterNumber: null },
        {
          defaultProvider: 'openai',
          defaultModel: 'gpt-5.4',
          agentRunner: { run: vi.fn() },
          promptRepository: {
            findLatestEnabledByAgentName: vi.fn()
          },
          storyStateRepository: {
            getStoryState: vi.fn().mockResolvedValue({
              projectId: 'project-1',
              volumePlans: [],
              confirmedFacts: [],
              openForeshadowing: [],
              chapterSummaries: [],
              currentPosition: { nextChapterNumber: 8, currentVolumeNumber: null }
            }),
            getNextChapterNumber: vi.fn().mockResolvedValue(8),
            invalidateChapterPlansInRange: vi.fn(),
            saveChapterPlan: vi.fn(),
            saveChapterDraft: vi.fn(),
            saveChapterState: vi.fn()
          }
        }
      )
    ).rejects.toThrow('Story state is not ready for next chapter generation: project-1');
  });

  it('fails when chapter plan output is missing required fields', async () => {
    const { executeGenerateChapter } = await import(
      '../../packages/workflows/src/chapter-executors'
    );

    await expect(
      executeGenerateChapter(
        { projectId: 'project-1', chapterNumber: null },
        {
          defaultProvider: 'openai',
          defaultModel: 'gpt-5.4',
          agentRunner: {
            run: vi.fn().mockResolvedValue({
              rawOutput: '{"goal":"确认郡守幕僚身份"}',
              parsedOutput: null,
              tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
            })
          },
          promptRepository: {
            findLatestEnabledByAgentName: vi.fn().mockResolvedValue({
              agentName: 'chapter-plan-agent',
              version: 2,
              systemPrompt: 'You are the chapter planner.',
              taskTemplate: 'Plan the next chapter.'
            })
          },
          storyStateRepository: {
            getStoryState: vi.fn().mockResolvedValue({
              projectId: 'project-1',
              volumePlans: [{ volumeNumber: 2, goal: '郡城迷局' }],
              confirmedFacts: [],
              openForeshadowing: [],
              chapterSummaries: [],
              currentPosition: { nextChapterNumber: 8, currentVolumeNumber: 2 }
            }),
            getNextChapterNumber: vi.fn().mockResolvedValue(8),
            invalidateChapterPlansInRange: vi.fn(),
            saveChapterPlan: vi.fn(),
            saveChapterDraft: vi.fn(),
            saveChapterState: vi.fn()
          }
        }
      )
    ).rejects.toThrow('Invalid chapter plan output: missing title');
  });

  it('fails when chapter draft output is empty', async () => {
    const { executeGenerateChapter } = await import(
      '../../packages/workflows/src/chapter-executors'
    );

    await expect(
      executeGenerateChapter(
        { projectId: 'project-1', chapterNumber: null },
        {
          defaultProvider: 'openai',
          defaultModel: 'gpt-5.4',
          agentRunner: {
            run: vi
              .fn()
              .mockResolvedValueOnce({
                rawOutput:
                  '{"title":"第八章 夜探藏书阁","goal":"确认郡守幕僚身份","beats":["潜入"],"povCharacter":"陆临"}',
                parsedOutput: null,
                tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
              })
              .mockResolvedValueOnce({
                rawOutput: '   ',
                parsedOutput: null,
                tokenUsage: { promptTokens: 12, completionTokens: 40, totalTokens: 52 }
              })
          },
          promptRepository: {
            findLatestEnabledByAgentName: vi
              .fn()
              .mockResolvedValueOnce({
                agentName: 'chapter-plan-agent',
                version: 2,
                systemPrompt: 'You are the chapter planner.',
                taskTemplate: 'Plan the next chapter.'
              })
              .mockResolvedValueOnce({
                agentName: 'chapter-draft-agent',
                version: 5,
                systemPrompt: 'You are the chapter drafter.',
                taskTemplate: 'Draft the approved chapter plan.'
              })
          },
          storyStateRepository: {
            getStoryState: vi.fn().mockResolvedValue({
              projectId: 'project-1',
              volumePlans: [{ volumeNumber: 2, goal: '郡城迷局' }],
              confirmedFacts: [],
              openForeshadowing: [],
              chapterSummaries: [],
              currentPosition: { nextChapterNumber: 8, currentVolumeNumber: 2 }
            }),
            getNextChapterNumber: vi.fn().mockResolvedValue(8),
            invalidateChapterPlansInRange: vi.fn().mockResolvedValue({ count: 0 }),
            saveChapterPlan: vi.fn(),
            saveChapterDraft: vi.fn(),
            saveChapterState: vi.fn()
          }
        }
      )
    ).rejects.toThrow('Invalid chapter draft output: empty content');
  });
});
