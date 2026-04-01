import { describe, expect, it, vi } from 'vitest';
import { createAgentRunner } from '../../packages/agent-runtime/src/agent-runner';

describe('agent runner', () => {
  it('acquires capacity, renders the prompt, and records a succeeded run', async () => {
    const acquire = vi.fn().mockResolvedValue({
      leaseId: 'lease-1',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      apiKeyId: 'key-1'
    });
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
      inputSnapshot: { premise: '小城捕快卷入仙门秘案' }
    });

    expect(renderPrompt).toHaveBeenCalled();
    expect(invokeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'rendered prompt',
        provider: 'openai',
        model: 'gpt-5.4-mini'
      })
    );
    expect(saveAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'outline-agent',
        leaseId: 'lease-1',
        status: 'succeeded'
      })
    );
    expect(release).toHaveBeenCalledWith('lease-1');
    expect(result.parsedOutput).toEqual({ title: '第一卷' });
  });
});
