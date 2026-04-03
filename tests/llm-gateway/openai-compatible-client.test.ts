import { afterEach, describe, expect, it, vi } from 'vitest';
import { invokeOpenAICompatibleModel } from '../../packages/llm-gateway/src';

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function createMockResponse(status: number, body: unknown): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('invokeOpenAICompatibleModel', () => {
  it('invokes a relay through /responses mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createMockResponse(200, {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Relay response text' }]
          }
        ]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await invokeOpenAICompatibleModel({
      baseUrl: 'https://relay.example.com/v1',
      apiKey: 'relay-secret',
      model: 'gpt-5.4',
      protocolMode: 'responses',
      prompt: 'Write a scene outline.'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer relay-secret',
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          model: 'gpt-5.4',
          input: 'Write a scene outline.'
        })
      })
    );
    expect(result.rawOutput).toBe('Relay response text');
    expect(result.parsedOutput).toBeNull();
    expect(result.tokenUsage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    });
  });

  it('invokes a relay through /chat/completions mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createMockResponse(200, {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Chat completion text'
            }
          }
        ]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await invokeOpenAICompatibleModel({
      baseUrl: 'https://relay.example.com/v1',
      apiKey: 'relay-secret',
      model: 'gpt-5.4',
      protocolMode: 'chat_completions',
      prompt: 'Write a scene outline.'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer relay-secret',
          'content-type': 'application/json'
        }),
        body: JSON.stringify({
          model: 'gpt-5.4',
          messages: [{ role: 'user', content: 'Write a scene outline.' }]
        })
      })
    );
    expect(result.rawOutput).toBe('Chat completion text');
    expect(result.parsedOutput).toBeNull();
    expect(result.tokenUsage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    });
  });

  it('falls back from /responses to /chat/completions in auto mode on protocol incompatibility', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createMockResponse(404, {
        error: {
          message: 'Not found'
        }
      })
    );
    fetchMock.mockResolvedValueOnce(
      createMockResponse(200, {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Fallback chat text'
            }
          }
        ]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await invokeOpenAICompatibleModel({
      baseUrl: 'https://relay.example.com/v1',
      apiKey: 'relay-secret',
      model: 'gpt-5.4',
      protocolMode: 'auto',
      prompt: 'Write a scene outline.'
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://relay.example.com/v1/responses',
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://relay.example.com/v1/chat/completions',
      expect.any(Object)
    );
    expect(result.rawOutput).toBe('Fallback chat text');
    expect(result.parsedOutput).toBeNull();
  });

  it('does not fall back on authorization failures in auto mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createMockResponse(401, {
        error: {
          message: 'Unauthorized'
        }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      invokeOpenAICompatibleModel({
        baseUrl: 'https://relay.example.com/v1',
        apiKey: 'relay-secret',
        model: 'gpt-5.4',
        protocolMode: 'auto',
        prompt: 'Write a scene outline.'
      })
    ).rejects.toThrow(/401|Unauthorized/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fall back on transport failures in auto mode', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      invokeOpenAICompatibleModel({
        baseUrl: 'https://relay.example.com/v1',
        apiKey: 'relay-secret',
        model: 'gpt-5.4',
        protocolMode: 'auto',
        prompt: 'Write a scene outline.'
      })
    ).rejects.toThrow('fetch failed');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails on malformed responses payloads without falling back', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createMockResponse(200, {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text' }]
          }
        ]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      invokeOpenAICompatibleModel({
        baseUrl: 'https://relay.example.com/v1',
        apiKey: 'relay-secret',
        model: 'gpt-5.4',
        protocolMode: 'auto',
        prompt: 'Write a scene outline.'
      })
    ).rejects.toThrow(/malformed|missing|text/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
