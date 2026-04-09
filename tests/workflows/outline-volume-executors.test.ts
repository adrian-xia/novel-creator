import { describe, expect, it, vi } from 'vitest';

describe('outline and volume executors', () => {
  it('runs, validates, and persists outline output across separate workflow steps', async () => {
    const {
      loadOutlineProjectStep,
      loadOutlinePromptStep,
      runOutlineAgentStep,
      validateOutlineOutputStep,
      persistOutlineStep
    } = await import(
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
          version: 3,
          systemPrompt: 'You are the outline planner.',
          taskTemplate: 'Generate a serialized outline.'
        })
      },
      storyStateRepository: {
        saveOutline
      }
    };

    const loadedProject = await loadOutlineProjectStep(context, deps);
    const loadedPrompt = await loadOutlinePromptStep(loadedProject, deps);
    const ranAgent = await runOutlineAgentStep(loadedPrompt, deps);
    const validated = await validateOutlineOutputStep(ranAgent);

    await expect(persistOutlineStep(validated, deps)).resolves.toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        chapterNumber: null,
        outline: { title: '卷一' },
        storyBible: '宗门与王朝对峙'
      })
    );
    expect(run).toHaveBeenCalledWith({
      agentType: 'outline-agent',
      promptConfigVersion: 3,
      projectId: 'project-1',
      chapterNumber: null,
      provider: 'openai',
      model: 'gpt-5.4',
      inputSnapshot: {
        systemPrompt: 'You are the outline planner.',
        taskTemplate: 'Generate a serialized outline.',
        variables: {
          premise: '山门弃徒卷入王朝旧案',
          genre: '仙侠'
        }
      }
    });
    expect(saveOutline).toHaveBeenCalledWith({
      projectId: 'project-1',
      outline: { title: '卷一' },
      storyBible: '宗门与王朝对峙'
    });
  });

  it('runs, validates, and persists volume plans across separate workflow steps', async () => {
    const {
      loadVolumeOutlineStep,
      loadVolumePromptStep,
      runVolumeAgentStep,
      validateVolumeOutputStep,
      persistVolumePlansStep
    } = await import(
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
          version: 4,
          systemPrompt: 'You are the volume planner.',
          taskTemplate: 'Expand the outline into volume plans.'
        })
      },
      storyStateRepository: {
        saveVolumePlans
      }
    };

    const loadedOutline = await loadVolumeOutlineStep(context, deps);
    const loadedPrompt = await loadVolumePromptStep(loadedOutline, deps);
    const ranAgent = await runVolumeAgentStep(loadedPrompt, deps);
    const validated = await validateVolumeOutputStep(ranAgent);

    await expect(persistVolumePlansStep(validated, deps)).resolves.toEqual(
      expect.objectContaining({
        projectId: 'project-1',
        chapterNumber: null,
        outline: { title: '卷一' },
        storyBible: '宗门与王朝对峙',
        volumePlans: [{ volumeNumber: 1, goal: '入宗' }]
      })
    );
    expect(run).toHaveBeenCalledWith({
      agentType: 'volume-agent',
      promptConfigVersion: 4,
      projectId: 'project-1',
      chapterNumber: null,
      provider: 'openai',
      model: 'gpt-5.4',
      inputSnapshot: {
        systemPrompt: 'You are the volume planner.',
        taskTemplate: 'Expand the outline into volume plans.',
        variables: {
          premise: '山门弃徒卷入王朝旧案',
          genre: '仙侠',
          outline: { title: '卷一' },
          storyBible: '宗门与王朝对峙'
        }
      }
    });
    expect(saveVolumePlans).toHaveBeenCalledWith({
      projectId: 'project-1',
      plans: [{ volumeNumber: 1, goal: '入宗' }]
    });
  });

  it('fails outline execution when runtime deps are missing', async () => {
    const { runOutlineAgentStep } = await import(
      '../../packages/workflows/src/outline-volume-executors'
    );

    await expect(
      runOutlineAgentStep(
        {
          projectId: 'project-1',
          chapterNumber: null,
          project: {
            id: 'project-1',
            premise: '边城孤灯',
            genre: '仙侠'
          },
          prompt: {
            id: 'prompt-1',
            agentName: 'outline-agent',
            version: 1,
            systemPrompt: 'system',
            taskTemplate: 'task',
            outputSchema: { type: 'object' },
            enabled: true
          }
        },
        {
          projectRepository: { findById: vi.fn() },
          promptRepository: { findLatestEnabledByAgentName: vi.fn() },
          storyStateRepository: { saveOutline: vi.fn(), saveVolumePlans: vi.fn() }
        }
      )
    ).rejects.toThrow('Outline and volume workflow runtime dependencies are not configured');
  });

  it('fails volume loading when outline prerequisites are missing', async () => {
    const { loadVolumeOutlineStep } = await import(
      '../../packages/workflows/src/outline-volume-executors'
    );

    await expect(
      loadVolumeOutlineStep(
        {
          projectId: 'project-1',
          chapterNumber: null
        },
        {
          projectRepository: {
            findByIdWithStoryState: vi.fn().mockResolvedValue({
              id: 'project-1',
              premise: '边城孤灯',
              genre: '仙侠',
              storyState: null
            })
          },
          promptRepository: { findLatestEnabledByAgentName: vi.fn() },
          storyStateRepository: { saveOutline: vi.fn(), saveVolumePlans: vi.fn() }
        }
      )
    ).rejects.toThrow('Outline not found for project project-1');
  });

  it('fails outline validation on malformed agent output', async () => {
    const { validateOutlineOutputStep } = await import(
      '../../packages/workflows/src/outline-volume-executors'
    );

    await expect(
      validateOutlineOutputStep({
        projectId: 'project-1',
        chapterNumber: null,
        rawOutlineOutput: { storyBible: '缺少标题' }
      })
    ).rejects.toThrow('Invalid outline output: missing title');
  });

  it('fails volume validation on malformed plans', async () => {
    const { validateVolumeOutputStep } = await import(
      '../../packages/workflows/src/outline-volume-executors'
    );

    await expect(
      validateVolumeOutputStep({
        projectId: 'project-1',
        chapterNumber: null,
        rawVolumeOutput: { plans: ['卷一'] as unknown as Array<Record<string, unknown>> }
      })
    ).rejects.toThrow('Invalid volume output: plan 1 is not an object');
  });
});
