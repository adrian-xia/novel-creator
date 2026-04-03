# OpenAI-Compatible Relay Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-provider-capacity support for third-party OpenAI-compatible relay endpoints, including `responses` and `chat/completions` compatibility, without leaking protocol details into agent runtime.

**Architecture:** Extend `ProviderCapacity` so each capacity record carries relay connection information, add a dedicated OpenAI-compatible client in `packages/llm-gateway`, and keep `packages/agent-runtime` dependent on normalized `invokeModel(...)` behavior only. The implementation should prefer explicit protocol modes and only allow `auto` fallback for true protocol incompatibility.

**Tech Stack:** TypeScript, Prisma repositories, Fastify, Vitest, mocked `fetch`

---

### Task 1: Expand Provider Capacity Types And Persistence

**Files:**
- Modify: `packages/domain/src/provider-capacity.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/storage/src/repositories/provider-capacity-repository.ts`
- Modify: `tests/storage/provider-capacity-repository.test.ts`
- Modify: `tests/llm-gateway/capacity-service.test.ts`
- Modify: `tests/api/provider-capacity.test.ts`

- [x] **Step 1: Write the failing tests for the expanded provider-capacity contract**

```ts
expect(createProviderCapacityRecordMock).toHaveBeenCalledWith(
  expect.objectContaining({
    baseUrl: 'https://relay.example.com/v1',
    apiKeySecretRef: 'vault://relay/openai-compatible',
    protocolMode: 'auto'
  })
);
```

```ts
const service = new CapacityService([
  {
    id: 'key-a',
    provider: 'relay-openai',
    model: 'gpt-5.4',
    keyName: 'primary',
    baseUrl: 'https://relay.example.com/v1',
    apiKeySecretRef: 'vault://relay/openai-compatible',
    protocolMode: 'responses',
    enabled: true,
    maxConcurrentRequests: 1,
    requestsPerMinute: 120,
    tokensPerMinute: 240000,
    dailyBudget: '50.00',
    priority: 1,
    currentLeases: 0
  }
]);
```

- [x] **Step 2: Run the focused contract tests to verify RED**

Run: `corepack pnpm vitest run tests/storage/provider-capacity-repository.test.ts tests/llm-gateway/capacity-service.test.ts tests/api/provider-capacity.test.ts`

Expected: FAIL because `ProviderCapacity` still exposes `secretRef` only and neither the API tests nor repository tests know about `baseUrl`, `apiKeySecretRef`, or `protocolMode`.

- [x] **Step 3: Implement the new domain and persistence shape**

```ts
export interface ProviderCapacity {
  id: string;
  provider: string;
  model: string;
  keyName: string;
  baseUrl: string;
  apiKeySecretRef: string;
  protocolMode: 'auto' | 'responses' | 'chat_completions';
  maxConcurrentRequests: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  dailyBudget: string;
  enabled: boolean;
  priority: number;
}
```

```ts
return prisma.providerCapacity.create({
  data: providerCapacity
});
```

- [x] **Step 4: Run the focused contract tests to verify GREEN**

Run: `corepack pnpm vitest run tests/storage/provider-capacity-repository.test.ts tests/llm-gateway/capacity-service.test.ts tests/api/provider-capacity.test.ts`

Expected: PASS with the new capacity shape accepted everywhere that consumes the domain type.

### Task 2: Update Provider Capacity API Validation And Storage-Backed Route Behavior

**Files:**
- Modify: `apps/api/src/routes/validation.ts`
- Modify: `apps/api/src/routes/provider-capacity.ts`
- Modify: `tests/api/provider-capacity.test.ts`

- [x] **Step 1: Extend the route tests with protocol/base URL validation failures**

```ts
const response = await app.inject({
  method: 'POST',
  url: '/provider-capacity',
  payload: {
    provider: 'relay-openai',
    model: 'gpt-5.4',
    keyName: 'primary',
    baseUrl: '',
    apiKeySecretRef: 'vault://relay/openai-compatible',
    protocolMode: 'invalid-mode',
    maxConcurrentRequests: 8,
    requestsPerMinute: 120,
    tokensPerMinute: 240000,
    dailyBudget: '50.00',
    enabled: true,
    priority: 1
  }
});

expect(response.statusCode).toBe(400);
```

- [x] **Step 2: Run the provider-capacity route tests to verify RED**

Run: `corepack pnpm vitest run tests/api/provider-capacity.test.ts`

Expected: FAIL because the validation layer still accepts `secretRef` and does not enforce `baseUrl` or `protocolMode`.

- [x] **Step 3: Implement minimal validation and route wiring**

```ts
if (
  !isString(baseUrl) ||
  baseUrl.length === 0 ||
  !isString(apiKeySecretRef) ||
  apiKeySecretRef.length === 0 ||
  !isOneOf(protocolMode, ['auto', 'responses', 'chat_completions'] as const)
) {
  return null;
}
```

```ts
const providerCapacity: ProviderCapacity = {
  ...providerCapacityPayload,
  id: crypto.randomUUID()
};
```

- [x] **Step 4: Run the provider-capacity route tests to verify GREEN**

Run: `corepack pnpm vitest run tests/api/provider-capacity.test.ts`

Expected: PASS with the API now accepting only the new relay-capable shape.

### Task 3: Add A Real OpenAI-Compatible Gateway Client

**Files:**
- Create: `packages/llm-gateway/src/openai-compatible-client.ts`
- Modify: `packages/llm-gateway/src/index.ts`
- Create: `tests/llm-gateway/openai-compatible-client.test.ts`

- [x] **Step 1: Write the failing gateway-client tests**

```ts
it('invokes a relay through /responses mode', async () => {
  expect(fetchMock).toHaveBeenCalledWith('https://relay.example.com/v1/responses', expect.any(Object));
  expect(result.rawOutput).toBe('Relay response text');
});

it('falls back from /responses to /chat/completions in auto mode only on protocol incompatibility', async () => {
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
});
```

- [x] **Step 2: Run the gateway-client tests to verify RED**

Run: `corepack pnpm vitest run tests/llm-gateway/openai-compatible-client.test.ts`

Expected: FAIL because no OpenAI-compatible client exists yet.

- [x] **Step 3: Implement the client with protocol-mode handling**

```ts
export async function invokeOpenAICompatibleModel(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  protocolMode: 'auto' | 'responses' | 'chat_completions';
  prompt: string;
}) {
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
```

- [x] **Step 4: Run the gateway-client tests to verify GREEN**

Run: `corepack pnpm vitest run tests/llm-gateway/openai-compatible-client.test.ts`

Expected: PASS with `responses`, `chat_completions`, and `auto` fallback covered.

### Task 4: Wire Runtime To The Relay-Capable Gateway And Verify End-To-End Behavior

**Files:**
- Modify: `packages/agent-runtime/src/agent-runner.ts`
- Modify: `tests/agent-runtime/agent-runner.test.ts`
- Modify: `README.md`

- [x] **Step 1: Add a failing runtime test for relay-capable invocation**

```ts
await runner.run({
  agentType: 'outline-agent',
  promptConfigVersion: 1,
  projectId: 'project-1',
  chapterNumber: null,
  provider: 'relay-openai',
  model: 'gpt-5.4',
  inputSnapshot: { brief: 'Generate an outline.' }
});

expect(invokeModel).toHaveBeenCalledWith({
  prompt: expect.any(String),
  provider: 'relay-openai',
  model: 'gpt-5.4'
});
```

- [x] **Step 2: Run the runtime and broader relay-focused tests to verify RED**

Run: `corepack pnpm vitest run tests/agent-runtime/agent-runner.test.ts tests/api/provider-capacity.test.ts tests/llm-gateway/openai-compatible-client.test.ts`

Expected: FAIL until the runtime and gateway contract line up with the new provider-capacity shape.

- [x] **Step 3: Implement minimal runtime wiring and docs update**

```ts
await deps.saveAgentRun({
  projectId: input.projectId,
  chapterNumber: input.chapterNumber,
  agentType: input.agentType,
  promptConfigVersion: input.promptConfigVersion,
  provider: input.provider,
  model: input.model,
  apiKeyId: lease.keyId,
  leaseId: lease.leaseId,
  inputSnapshot: input.inputSnapshot,
  rawOutput: result.rawOutput,
  parsedOutput: result.parsedOutput,
  status: 'succeeded',
  tokenUsage: result.tokenUsage,
  errorMessage: null
});
```

```md
- provider capacity records can target third-party OpenAI-compatible relays via per-capacity `baseUrl`, `apiKeySecretRef`, and `protocolMode`
```

- [x] **Step 4: Run the broad regression suite**

Run: `corepack pnpm vitest run tests/api tests/web tests/worker tests/storage tests/e2e tests/workflows tests/agent-runtime tests/llm-gateway`

Expected: PASS across the repository with relay support integrated and no regression to existing capacity/runtime behavior.
