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
    const { HumanGateRequestedError } = await import(
      '../../packages/workflows/src/human-gate'
    );
    const saveOutline = vi.fn().mockResolvedValue(undefined);
    const createHumanGateSession = vi.fn().mockResolvedValue({ id: 'session-outline-1' });
    const run = vi.fn().mockResolvedValue({
      parsedOutput: { title: '卷一', storyBible: '宗门与王朝对峙' }
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
          storyState: null
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
      },
      decisionSessionRepository: {
        createHumanGateSession
      }
    };

    const loadedProject = await loadOutlineProjectStep(context, deps);
    const loadedPrompt = await loadOutlinePromptStep(loadedProject, deps);
    const ranAgent = await runOutlineAgentStep(loadedPrompt, deps);
    const validated = await validateOutlineOutputStep(ranAgent);

    await expect(persistOutlineStep(validated, deps)).rejects.toBeInstanceOf(
      HumanGateRequestedError
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
    expect(createHumanGateSession).toHaveBeenCalledWith({
      projectId: 'project-1',
      chapterNumber: null,
      gateType: 'outline_confirmation',
      triggerReason: 'outline_ready_for_confirmation',
      contextSnapshot: {
        outline: { title: '卷一' },
        storyBible: '宗门与王朝对峙'
      },
      options: [
        {
          optionId: 'accept-outline',
          title: 'Use this outline',
          strategy: 'recommended',
          rationale: 'The generated outline is persisted and ready for confirmation.',
          impactSummary: 'Approve to continue into volume planning with the saved outline.',
          patch: { action: 'accept_outline' }
        },
        {
          optionId: 'revise-outline',
          title: 'Revise outline',
          strategy: 'alternative',
          rationale: 'Pause here if the outline needs human edits or a refreshed outline pass.',
          impactSummary: 'Keeps the saved outline available for review before any volume plans are generated.',
          patch: { action: 'revise_outline' }
        }
      ],
      recommendedOptionId: 'accept-outline'
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
    const { HumanGateRequestedError } = await import(
      '../../packages/workflows/src/human-gate'
    );
    const saveVolumePlans = vi.fn().mockResolvedValue(undefined);
    const createHumanGateSession = vi.fn().mockResolvedValue({ id: 'session-volume-1' });
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
      },
      decisionSessionRepository: {
        createHumanGateSession,
        listSessions: vi.fn().mockResolvedValue([
          {
            id: 'outline-gate-1',
            projectId: 'project-1',
            gateType: 'outline_confirmation',
            status: 'resolved',
            selectedOptionId: 'accept-outline',
            updatedAt: '2026-04-10T10:00:00.000Z'
          }
        ])
      }
    };

    const loadedOutline = await loadVolumeOutlineStep(context, deps);
    const loadedPrompt = await loadVolumePromptStep(loadedOutline, deps);
    const ranAgent = await runVolumeAgentStep(loadedPrompt, deps);
    const validated = await validateVolumeOutputStep(ranAgent);

    await expect(persistVolumePlansStep(validated, deps)).rejects.toBeInstanceOf(
      HumanGateRequestedError
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
    expect(createHumanGateSession).toHaveBeenCalledWith({
      projectId: 'project-1',
      chapterNumber: null,
      gateType: 'volume_confirmation',
      triggerReason: 'volume_plans_ready_for_confirmation',
      contextSnapshot: {
        outline: { title: '卷一' },
        storyBible: '宗门与王朝对峙',
        volumePlans: [{ volumeNumber: 1, goal: '入宗' }]
      },
      options: [
        {
          optionId: 'accept-volume-plans',
          title: 'Use these volume plans',
          strategy: 'recommended',
          rationale: 'The generated volume plans are persisted and ready for confirmation.',
          impactSummary: 'Approve to continue with the saved volume structure.',
          patch: { action: 'accept_volume_plans' }
        },
        {
          optionId: 'revise-volume-plans',
          title: 'Revise volume plans',
          strategy: 'alternative',
          rationale: 'Pause here if the volume breakdown needs human edits or a refreshed planning pass.',
          impactSummary: 'Keeps the saved plans available for review before downstream chapter work begins.',
          patch: { action: 'revise_volume_plans' }
        }
      ],
      recommendedOptionId: 'accept-volume-plans'
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
          projectRepository: { findByIdWithStoryState: vi.fn() },
          promptRepository: { findLatestEnabledByAgentName: vi.fn() },
          storyStateRepository: { saveOutline: vi.fn(), saveVolumePlans: vi.fn() },
          decisionSessionRepository: { createHumanGateSession: vi.fn() }
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
          storyStateRepository: { saveOutline: vi.fn(), saveVolumePlans: vi.fn() },
          decisionSessionRepository: {
            listSessions: vi.fn().mockResolvedValue([
              {
                id: 'outline-gate-1',
                projectId: 'project-1',
                gateType: 'outline_confirmation',
                status: 'resolved',
                selectedOptionId: 'accept-outline',
                updatedAt: '2026-04-10T10:00:00.000Z'
              }
            ])
          }
        }
      )
    ).rejects.toThrow('Outline not found for project project-1');
  });

  it('fails volume loading when the outline confirmation gate is still unresolved', async () => {
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
              storyState: {
                outline: { title: '卷一' },
                storyBible: '宗门与王朝对峙'
              }
            })
          },
          promptRepository: { findLatestEnabledByAgentName: vi.fn() },
          storyStateRepository: { saveOutline: vi.fn(), saveVolumePlans: vi.fn() },
          decisionSessionRepository: {
            listSessions: vi.fn().mockResolvedValue([
              {
                id: 'outline-gate-older',
                projectId: 'project-1',
                gateType: 'outline_confirmation',
                status: 'resolved',
                selectedOptionId: 'accept-outline',
                updatedAt: '2026-04-10T09:00:00.000Z'
              },
              {
                id: 'outline-gate-1',
                projectId: 'project-1',
                gateType: 'outline_confirmation',
                status: 'open',
                selectedOptionId: null,
                updatedAt: '2026-04-10T11:00:00.000Z'
              }
            ])
          }
        }
      )
    ).rejects.toThrow(
      'Human gate outline_confirmation must be accepted with accept-outline before continuing project project-1'
    );
  });

  it('fails volume loading when the latest outline confirmation chose revise-outline', async () => {
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
              storyState: {
                outline: { title: '卷一' },
                storyBible: '宗门与王朝对峙'
              }
            })
          },
          promptRepository: { findLatestEnabledByAgentName: vi.fn() },
          storyStateRepository: { saveOutline: vi.fn(), saveVolumePlans: vi.fn() },
          decisionSessionRepository: {
            listSessions: vi.fn().mockResolvedValue([
              {
                id: 'outline-gate-1',
                projectId: 'project-1',
                gateType: 'outline_confirmation',
                status: 'resolved',
                selectedOptionId: 'revise-outline',
                updatedAt: '2026-04-10T11:00:00.000Z'
              }
            ])
          }
        }
      )
    ).rejects.toThrow(
      'Human gate outline_confirmation must be accepted with accept-outline before continuing project project-1'
    );
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

  it('validates outline output from raw model JSON when parsed output is unavailable', async () => {
    const {
      loadOutlineProjectStep,
      loadOutlinePromptStep,
      runOutlineAgentStep,
      validateOutlineOutputStep
    } = await import(
      '../../packages/workflows/src/outline-volume-executors'
    );
    const run = vi.fn().mockResolvedValue({
      rawOutput: '{"title":"卷一","storyBible":"宗门与王朝对峙"}',
      parsedOutput: null
    });
    const deps = {
      defaultProvider: 'openai',
      defaultModel: 'gpt-5.4',
      agentRunner: { run },
      projectRepository: {
        findByIdWithStoryState: vi.fn().mockResolvedValue({
          id: 'project-1',
          premise: '山门弃徒卷入王朝旧案',
          genre: '仙侠',
          storyState: null
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
        saveOutline: vi.fn()
      },
      decisionSessionRepository: {
        createHumanGateSession: vi.fn()
      }
    };

    const loadedProject = await loadOutlineProjectStep(
      { projectId: 'project-1', chapterNumber: null },
      deps
    );
    const loadedPrompt = await loadOutlinePromptStep(loadedProject, deps);
    const ranAgent = await runOutlineAgentStep(loadedPrompt, deps);

    await expect(validateOutlineOutputStep(ranAgent)).resolves.toEqual(
      expect.objectContaining({
        outline: { title: '卷一' },
        storyBible: '宗门与王朝对峙'
      })
    );
  });

  it('preserves the existing story bible when outline output omits it', async () => {
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
      parsedOutput: { title: '卷一' }
    });
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
            storyBible: '旧版设定集'
          }
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
      },
      decisionSessionRepository: {
        createHumanGateSession: vi.fn().mockResolvedValue({ id: 'session-outline-2' })
      }
    };

    const loadedProject = await loadOutlineProjectStep(
      { projectId: 'project-1', chapterNumber: null },
      deps
    );
    const loadedPrompt = await loadOutlinePromptStep(loadedProject, deps);
    const ranAgent = await runOutlineAgentStep(loadedPrompt, deps);
    const validated = await validateOutlineOutputStep(ranAgent);

    await expect(persistOutlineStep(validated, deps)).rejects.toMatchObject({
      name: 'HumanGateRequestedError',
      sessionId: 'session-outline-2'
    });

    expect(saveOutline).toHaveBeenCalledWith({
      projectId: 'project-1',
      outline: { title: '卷一' },
      storyBible: '旧版设定集'
    });
  });

  it('validates volume output from raw model JSON when parsed output is unavailable', async () => {
    const {
      loadVolumeOutlineStep,
      loadVolumePromptStep,
      runVolumeAgentStep,
      validateVolumeOutputStep
    } = await import(
      '../../packages/workflows/src/outline-volume-executors'
    );
    const run = vi.fn().mockResolvedValue({
      rawOutput: '{"plans":[{"volumeNumber":1,"goal":"入宗"}]}',
      parsedOutput: null
    });
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
        saveVolumePlans: vi.fn()
      },
      decisionSessionRepository: {
        listSessions: vi.fn().mockResolvedValue([
          {
            id: 'outline-gate-1',
            projectId: 'project-1',
            gateType: 'outline_confirmation',
            status: 'resolved',
            selectedOptionId: 'accept-outline',
            updatedAt: '2026-04-10T10:00:00.000Z'
          }
        ])
      }
    };

    const loadedOutline = await loadVolumeOutlineStep(
      { projectId: 'project-1', chapterNumber: null },
      deps
    );
    const loadedPrompt = await loadVolumePromptStep(loadedOutline, deps);
    const ranAgent = await runVolumeAgentStep(loadedPrompt, deps);

    await expect(validateVolumeOutputStep(ranAgent)).resolves.toEqual(
      expect.objectContaining({
        volumePlans: [{ volumeNumber: 1, goal: '入宗' }]
      })
    );
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
