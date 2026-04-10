import { describe, expect, it, vi } from 'vitest';

describe('review rewrite executors', () => {
  it('approves a chapter and appends its summary into story state', async () => {
    const { executeReviewRewrite } = await import(
      '../../packages/workflows/src/review-rewrite-executors'
    );
    const saveApprovedChapterSummary = vi.fn().mockResolvedValue(undefined);
    const deps = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.4',
      agentRunner: {
        run: vi.fn().mockResolvedValue({
          rawOutput: '{"decision":"approve","summary":"主角接受试炼。","issues":[],"rewriteInstructions":[]}',
          parsedOutput: null,
          tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
        })
      },
      promptRepository: {
        findLatestEnabledByAgentName: vi.fn().mockResolvedValue({
          agentName: 'review-agent',
          version: 4,
          systemPrompt: 'You are the review agent.',
          taskTemplate: 'Review the draft.'
        })
      },
      storyStateRepository: {
        getLatestChapterDraft: vi.fn().mockResolvedValue({
          projectId: 'project-1',
          chapterNumber: 8,
          version: 1,
          content: '第八章正文',
          summary: null,
          metadata: {}
        }),
        saveReviewOutcome: vi.fn().mockResolvedValue(undefined),
        saveWorkflowDecidedChapterState: vi.fn().mockResolvedValue(undefined),
        saveApprovedChapterSummary,
        saveChapterDraft: vi.fn(),
        markChapterBlockedForDecision: vi.fn()
      },
      decisionSessionRepository: {
        createBlockingDecisionTrigger: vi.fn()
      }
    };

    await expect(
      executeReviewRewrite(
        { projectId: 'project-1', chapterNumber: 8 },
        deps
      )
    ).resolves.toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        chapterNumber: 8,
        reviewDecision: 'approve'
      })
    );

    expect(saveApprovedChapterSummary).toHaveBeenCalledWith({
      projectId: 'project-1',
      chapterNumber: 8,
      summary: '主角接受试炼。',
      nextChapterNumber: 9
    });
  });

  it('creates a second draft version when review requests rewrite within the limit', async () => {
    const { executeReviewRewrite } = await import(
      '../../packages/workflows/src/review-rewrite-executors'
    );
    const saveChapterDraft = vi.fn().mockResolvedValue(undefined);
    const deps = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.4',
      agentRunner: {
        run: vi
          .fn()
          .mockResolvedValueOnce({
            rawOutput:
              '{"decision":"rewrite","issues":[],"rewriteInstructions":["强化冲突"]}',
            parsedOutput: null,
            tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
          .mockResolvedValueOnce({
            rawOutput: '第八章重写正文',
            parsedOutput: { metadata: { tone: 'tense' } },
            tokenUsage: { promptTokens: 8, completionTokens: 30, totalTokens: 38 }
          })
          .mockResolvedValueOnce({
            rawOutput:
              '{"decision":"approve","summary":"主角接受试炼。","issues":[],"rewriteInstructions":[]}',
            parsedOutput: null,
            tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
      },
      promptRepository: {
        findLatestEnabledByAgentName: vi
          .fn()
          .mockResolvedValueOnce({
            agentName: 'review-agent',
            version: 4,
            systemPrompt: 'You are the review agent.',
            taskTemplate: 'Review the draft.'
          })
          .mockResolvedValueOnce({
            agentName: 'rewrite-agent',
            version: 2,
            systemPrompt: 'You are the rewrite agent.',
            taskTemplate: 'Rewrite the draft.'
          })
          .mockResolvedValueOnce({
            agentName: 'review-agent',
            version: 4,
            systemPrompt: 'You are the review agent.',
            taskTemplate: 'Review the draft.'
          })
      },
      storyStateRepository: {
        getLatestChapterDraft: vi
          .fn()
          .mockResolvedValueOnce({
            projectId: 'project-1',
            chapterNumber: 8,
            version: 1,
            content: '第八章初稿',
            summary: null,
            metadata: {}
          })
          .mockResolvedValueOnce({
            projectId: 'project-1',
            chapterNumber: 8,
            version: 2,
            content: '第八章重写正文',
            summary: null,
            metadata: { tone: 'tense' }
          }),
        saveReviewOutcome: vi.fn().mockResolvedValue(undefined),
        saveWorkflowDecidedChapterState: vi.fn().mockResolvedValue(undefined),
        saveApprovedChapterSummary: vi.fn().mockResolvedValue(undefined),
        saveChapterDraft,
        markChapterBlockedForDecision: vi.fn()
      },
      decisionSessionRepository: {
        createBlockingDecisionTrigger: vi.fn()
      }
    };

    await executeReviewRewrite(
      { projectId: 'project-1', chapterNumber: 8 },
      deps
    );

    expect(saveChapterDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        chapterNumber: 8,
        version: 2
      })
    );
  });

  it('marks the chapter blocked and creates a decision trigger after rewrite limit exhaustion', async () => {
    const { executeReviewRewrite } = await import(
      '../../packages/workflows/src/review-rewrite-executors'
    );
    const markChapterBlockedForDecision = vi.fn().mockResolvedValue(undefined);
    const createBlockingDecisionTrigger = vi.fn().mockResolvedValue(undefined);
    const deps = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.4',
      agentRunner: {
        run: vi
          .fn()
          .mockResolvedValueOnce({
            rawOutput:
              '{"decision":"rewrite","issues":[],"rewriteInstructions":["强化冲突"]}',
            parsedOutput: null,
            tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
          .mockResolvedValueOnce({
            rawOutput: '第八章重写正文 v2',
            parsedOutput: { metadata: { version: 2 } },
            tokenUsage: { promptTokens: 8, completionTokens: 30, totalTokens: 38 }
          })
          .mockResolvedValueOnce({
            rawOutput:
              '{"decision":"rewrite","issues":[],"rewriteInstructions":["压缩节奏"]}',
            parsedOutput: null,
            tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
          .mockResolvedValueOnce({
            rawOutput: '第八章重写正文 v3',
            parsedOutput: { metadata: { version: 3 } },
            tokenUsage: { promptTokens: 8, completionTokens: 30, totalTokens: 38 }
          })
          .mockResolvedValueOnce({
            rawOutput:
              '{"decision":"rewrite","issues":[],"rewriteInstructions":["补足动机"]}',
            parsedOutput: null,
            tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
          })
      },
      promptRepository: {
        findLatestEnabledByAgentName: vi
          .fn()
          .mockResolvedValue({
            agentName: 'review-agent',
            version: 4,
            systemPrompt: 'system',
            taskTemplate: 'task'
          })
      },
      storyStateRepository: {
        getLatestChapterDraft: vi
          .fn()
          .mockResolvedValueOnce({
            projectId: 'project-1',
            chapterNumber: 8,
            version: 1,
            content: '第八章初稿',
            summary: null,
            metadata: {}
          })
          .mockResolvedValueOnce({
            projectId: 'project-1',
            chapterNumber: 8,
            version: 2,
            content: '第八章重写正文 v2',
            summary: null,
            metadata: { version: 2 }
          })
          .mockResolvedValueOnce({
            projectId: 'project-1',
            chapterNumber: 8,
            version: 3,
            content: '第八章重写正文 v3',
            summary: null,
            metadata: { version: 3 }
          }),
        saveReviewOutcome: vi.fn().mockResolvedValue(undefined),
        saveWorkflowDecidedChapterState: vi.fn().mockResolvedValue(undefined),
        saveApprovedChapterSummary: vi.fn().mockResolvedValue(undefined),
        saveChapterDraft: vi.fn().mockResolvedValue(undefined),
        markChapterBlockedForDecision
      },
      decisionSessionRepository: {
        createBlockingDecisionTrigger
      }
    };

    await executeReviewRewrite(
      { projectId: 'project-1', chapterNumber: 8 },
      deps
    );

    expect(markChapterBlockedForDecision).toHaveBeenCalledWith({
      projectId: 'project-1',
      chapterNumber: 8
    });
    expect(createBlockingDecisionTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        chapterNumber: 8
      })
    );
  });
});
