export type OpenAICompatibleProtocolMode = 'auto' | 'responses' | 'chat_completions';

export interface OpenAICompatibleModelInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  protocolMode: OpenAICompatibleProtocolMode;
  prompt: string;
}

export interface OpenAICompatibleTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface OpenAICompatibleModelResult {
  rawOutput: string;
  parsedOutput: Record<string, unknown> | null;
  tokenUsage: OpenAICompatibleTokenUsage;
}

type OpenAICompatibleResponseErrorKind = 'protocol' | 'request' | 'malformed';

class OpenAICompatibleResponseError extends Error {
  constructor(
    message: string,
    readonly kind: OpenAICompatibleResponseErrorKind,
    readonly status: number
  ) {
    super(message);
    this.name = 'OpenAICompatibleResponseError';
  }
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path}`;
}

function isProtocolCompatibilityError(error: unknown): boolean {
  return error instanceof OpenAICompatibleResponseError && error.kind === 'protocol';
}

function getObjectValue(input: unknown): Record<string, unknown> | null {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return null;
}

function extractTokenUsage(payload: unknown): OpenAICompatibleTokenUsage {
  const usage = getObjectValue(payload)?.usage;
  const usageObject = getObjectValue(usage);

  if (!usageObject) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
  }

  const promptTokens = usageObject.prompt_tokens;
  const completionTokens = usageObject.completion_tokens;
  const totalTokens = usageObject.total_tokens;

  if (
    typeof promptTokens !== 'number' ||
    typeof completionTokens !== 'number' ||
    typeof totalTokens !== 'number'
  ) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens
  };
}

function extractResponsesText(payload: unknown): string {
  const payloadObject = getObjectValue(payload);
  const output = payloadObject?.output;

  if (!Array.isArray(output)) {
    throw new OpenAICompatibleResponseError('Malformed responses payload: missing output', 'malformed', 200);
  }

  for (const item of output) {
    const itemObject = getObjectValue(item);
    const content = itemObject?.content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      const contentObject = getObjectValue(contentItem);
      const text = contentObject?.text;

      if (typeof text === 'string' && text.length > 0) {
        return text;
      }
    }
  }

  throw new OpenAICompatibleResponseError(
    'Malformed responses payload: missing text content',
    'malformed',
    200
  );
}

function extractChatCompletionsText(payload: unknown): string {
  const payloadObject = getObjectValue(payload);
  const choices = payloadObject?.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenAICompatibleResponseError(
      'Malformed chat completions payload: missing choices',
      'malformed',
      200
    );
  }

  const firstChoice = getObjectValue(choices[0]);
  const message = getObjectValue(firstChoice?.message);
  const content = message?.content;

  if (typeof content === 'string' && content.length > 0) {
    return content;
  }

  throw new OpenAICompatibleResponseError(
    'Malformed chat completions payload: missing message content',
    'malformed',
    200
  );
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function invokeViaResponses(input: OpenAICompatibleModelInput): Promise<OpenAICompatibleModelResult> {
  const response = await fetch(buildUrl(input.baseUrl, 'responses'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: input.model,
      input: input.prompt
    })
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      throw new OpenAICompatibleResponseError(
        `OpenAI-compatible relay does not support /responses (${response.status})`,
        'protocol',
        response.status
      );
    }

    throw new OpenAICompatibleResponseError(
      `OpenAI-compatible request failed with status ${response.status}`,
      'request',
      response.status
    );
  }

  const payload = await readJsonResponse(response);

  return {
    rawOutput: extractResponsesText(payload),
    parsedOutput: null,
    tokenUsage: extractTokenUsage(payload)
  };
}

async function invokeViaChatCompletions(
  input: OpenAICompatibleModelInput
): Promise<OpenAICompatibleModelResult> {
  const response = await fetch(buildUrl(input.baseUrl, 'chat/completions'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: input.model,
      messages: [{ role: 'user', content: input.prompt }]
    })
  });

  if (!response.ok) {
    throw new OpenAICompatibleResponseError(
      `OpenAI-compatible request failed with status ${response.status}`,
      'request',
      response.status
    );
  }

  const payload = await readJsonResponse(response);

  return {
    rawOutput: extractChatCompletionsText(payload),
    parsedOutput: null,
    tokenUsage: extractTokenUsage(payload)
  };
}

export async function invokeOpenAICompatibleModel(
  input: OpenAICompatibleModelInput
): Promise<OpenAICompatibleModelResult> {
  if (input.protocolMode === 'responses') {
    return invokeViaResponses(input);
  }

  if (input.protocolMode === 'chat_completions') {
    return invokeViaChatCompletions(input);
  }

  try {
    return await invokeViaResponses(input);
  } catch (error) {
    if (!isProtocolCompatibilityError(error)) {
      throw error;
    }

    return invokeViaChatCompletions(input);
  }
}
