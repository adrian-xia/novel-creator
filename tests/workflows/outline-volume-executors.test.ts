import { describe, expect, it, vi } from 'vitest';

describe('outline and volume executors', () => {
  it('persists outline output into both OutlineRecord and StoryState', async () => {
    const { executeOutlineStep } = await import(
      '../../packages/workflows/src/outline-volume-executors'
    );
    const saveOutline = vi.fn().mockResolvedValue(undefined);
    const run = vi.fn().mockResolvedValue({
      parsedOutput: { title: '卷一', storyBible: '宗门与王朝对峙' }
    });
    const context = { projectId: 'project-1', chapterNumber: null };
    const deps = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.4',
      agentRunner: { run },
      projectRepository: {
        findById: vi.fn().mockResolvedValue({
          id: 'project-1',
          premise: '山门弃徒卷入王朝旧案',
          genre: '仙侠'
        })
      },
      promptRepository: {
        findLatestEnabledByAgentName: vi.fn().mockResolvedValue({
          agentName: 'outline-agent',
          version: 3
        })
      },
      storyStateRepository: {
        saveOutline
      }
    };

    await expect(executeOutlineStep(context, deps)).resolves.toEqual({
      projectId: 'project-1',
      chapterNumber: null,
      outline: { title: '卷一', storyBible: '宗门与王朝对峙' },
      storyBible: '宗门与王朝对峙'
    });
    expect(run).toHaveBeenCalledWith({
      agentType: 'outline-agent',
      promptConfigVersion: 3,
      projectId: 'project-1',
      chapterNumber: null,
      provider: 'openai',
      model: 'gpt-5.4',
      inputSnapshot: {
        premise: '山门弃徒卷入王朝旧案',
        genre: '仙侠'
      }
    });
    expect(saveOutline).toHaveBeenCalledWith({
      projectId: 'project-1',
      outline: { title: '卷一', storyBible: '宗门与王朝对峙' },
      storyBible: '宗门与王朝对峙'
    });
  });

  it('persists volume plans and updates current position', async () => {
    const { executeVolumeStep } = await import(
      '../../packages/workflows/src/outline-volume-executors'
    );
    const saveVolumePlans = vi.fn().mockResolvedValue(undefined);
    const run = vi.fn().mockResolvedValue({
      parsedOutput: {
        plans: [{ volumeNumber: 1, goal: '入宗' }]
      }
    });
    const context = { projectId: 'project-1', chapterNumber: null };
    const deps = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.4',
      agentRunner: { run },
      projectRepository: {
        findByIdWithStoryState: vi.fn().mockResolvedValue({
          id: 'project-1',
          premise: '山门弃徒卷入王朝旧案',
          genre: '仙侠',
          storyState: {
            outline: { title: '卷一' },
            storyBible: '宗门与王朝对峙'
          }
        })
      },
      promptRepository: {
        findLatestEnabledByAgentName: vi.fn().mockResolvedValue({
          agentName: 'volume-agent',
          version: 4
        })
      },
      storyStateRepository: {
        saveVolumePlans
      }
    };

    await expect(executeVolumeStep(context, deps)).resolves.toEqual({
      projectId: 'project-1',
      chapterNumber: null,
      outline: { title: '卷一' },
      storyBible: '宗门与王朝对峙',
      volumePlans: [{ volumeNumber: 1, goal: '入宗' }]
    });
    expect(run).toHaveBeenCalledWith({
      agentType: 'volume-agent',
      promptConfigVersion: 4,
      projectId: 'project-1',
      chapterNumber: null,
      provider: 'openai',
      model: 'gpt-5.4',
      inputSnapshot: {
        premise: '山门弃徒卷入王朝旧案',
        genre: '仙侠',
        outline: { title: '卷一' },
        storyBible: '宗门与王朝对峙'
      }
    });
    expect(saveVolumePlans).toHaveBeenCalledWith({
      projectId: 'project-1',
      plans: [{ volumeNumber: 1, goal: '入宗' }]
    });
  });
});
