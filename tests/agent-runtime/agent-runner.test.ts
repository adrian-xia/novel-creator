import { describe, expect, it, vi } from 'vitest';
import { createAgentRunner } from '../../packages/agent-runtime/src/agent-runner';

describe('agent runner', () => {
  it('acquires capacity, renders the prompt, and records a succeeded run', async () => {
    const lease = { leaseId: 'lease-1', keyId: 'key-1' };
    const acquire = vi.fn().mockResolvedValue(lease);
    const release = vi.fn().mockResolvedValue(undefined);
    const renderPrompt = vi.fn().mockReturnValue('rendered prompt');
    const invokeModel = vi.fn().mockResolvedValue({
      rawOutput: '{"title":"第一卷"}',
      parsedOutput: { title: '第一卷' },
      tokenUsage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 }
    });
    const saveAgentRun = vi.fn().mockResolvedValue(undefined);

    const runner = createAgentRunner({
      acquire,
      release,
      renderPrompt,
      invokeModel,
      saveAgentRun
    });

    const result = await runner.run({
      agentType: 'outline-agent',
      promptConfigVersion: 3,
      projectId: 'project-1',
      chapterNumber: null,
      provider: 'openai',
      model: 'gpt-5.4-mini',
      inputSnapshot: { premise: '小城捕快卷入仙门秘案' }
    });

    expect(acquire).toHaveBeenCalledWith({ provider: 'openai', model: 'gpt-5.4-mini' });
    expect(renderPrompt).toHaveBeenCalledWith({ premise: '小城捕快卷入仙门秘案' });
    expect(invokeModel).toHaveBeenCalledWith({
      prompt: 'rendered prompt',
      provider: 'openai',
      model: 'gpt-5.4-mini'
    });
    expect(saveAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'outline-agent',
        provider: 'openai',
        model: 'gpt-5.4-mini',
        apiKeyId: 'key-1',
        leaseId: 'lease-1',
        status: 'succeeded'
      })
    );
    expect(release).toHaveBeenCalledWith(lease);
    expect(result.parsedOutput).toEqual({ title: '第一卷' });
  });

  it('records a failed run when model invocation fails and still releases the lease', async () => {
    const lease = { leaseId: 'lease-2', keyId: 'key-2' };
    const acquire = vi.fn().mockResolvedValue(lease);
    const release = vi.fn().mockResolvedValue(undefined);
    const renderPrompt = vi.fn().mockReturnValue('rendered prompt');
    const invokeModel = vi.fn().mockRejectedValue(new Error('model exploded'));
    const saveAgentRun = vi.fn().mockResolvedValue(undefined);

    const runner = createAgentRunner({
      acquire,
      release,
      renderPrompt,
      invokeModel,
      saveAgentRun
    });

    await expect(
      runner.run({
        agentType: 'chapter-plan-agent',
        promptConfigVersion: 4,
        projectId: 'project-2',
        chapterNumber: 12,
        provider: 'openai',
        model: 'gpt-5.4-mini',
        inputSnapshot: { chapterGoal: '夜探旧庙' }
      })
    ).rejects.toThrow('model exploded');

    expect(saveAgentRun).toHaveBeenCalledTimes(1);
    expect(saveAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'chapter-plan-agent',
        status: 'failed',
        rawOutput: '',
        parsedOutput: null,
        errorMessage: 'model exploded'
      })
    );
    expect(release).toHaveBeenCalledWith(lease);
  });

  it('releases the lease when writing the run audit fails without writing a fake failed run', async () => {
    const lease = { leaseId: 'lease-3', keyId: 'key-3' };
    const acquire = vi.fn().mockResolvedValue(lease);
    const release = vi.fn().mockResolvedValue(undefined);
    const renderPrompt = vi.fn().mockReturnValue('rendered prompt');
    const invokeModel = vi.fn().mockResolvedValue({
      rawOutput: '{"title":"第一卷"}',
      parsedOutput: { title: '第一卷' },
      tokenUsage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 }
    });
    const saveAgentRun = vi.fn().mockRejectedValue(new Error('audit unavailable'));

    const runner = createAgentRunner({
      acquire,
      release,
      renderPrompt,
      invokeModel,
      saveAgentRun
    });

    await expect(
      runner.run({
        agentType: 'outline-agent',
        promptConfigVersion: 3,
        projectId: 'project-3',
        chapterNumber: null,
        provider: 'openai',
        model: 'gpt-5.4-mini',
        inputSnapshot: { premise: '边城夜雨' }
      })
    ).rejects.toThrow('audit unavailable');

    expect(saveAgentRun).toHaveBeenCalledTimes(1);
    expect(saveAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        rawOutput: '{"title":"第一卷"}',
        parsedOutput: { title: '第一卷' }
      })
    );
    expect(release).toHaveBeenCalledWith(lease);
  });
});
