# OpenAI-Compatible Relay Support Design

**Date:** 2026-04-03

## Goal

Add support for third-party OpenAI-compatible relay endpoints so the system can invoke models through non-official OpenAI-compatible providers using per-capacity configuration, while keeping the existing runtime abstraction and capacity-pool flow intact.

## Scope

This design covers:

- per-`ProviderCapacity` connection configuration
- OpenAI-compatible HTTP invocation in `packages/llm-gateway`
- support for both `/responses` and `/chat/completions`
- automatic fallback between those protocols when configured
- API/storage/runtime/test updates needed to make the path usable end-to-end

This design does **not** cover:

- custom headers
- organization IDs
- extra query parameters
- external platform auto-upload
- direct browser-side model invocation

## Constraints

- Connection config must live on each `ProviderCapacity` record.
- Minimum supported config is `baseUrl + apiKey(secretRef) + model`.
- Both `responses` and `chat/completions` must be supported.
- The existing `agent-runtime` boundary should remain protocol-agnostic.
- Invalid upstream responses must fail explicitly; no silent success.

## Recommended Approach

Use a dedicated OpenAI-compatible client in `packages/llm-gateway`, backed by richer `ProviderCapacity` records, and keep `packages/agent-runtime` dependent only on an `invokeModel(...)` abstraction.

This keeps HTTP protocol details, fallback logic, and response normalization out of runtime/business code. It also leaves room for future providers without reworking the call path again.

## Alternatives Considered

### 1. Handle protocol branching inside `agent-runtime`

Rejected because it mixes runtime orchestration with provider HTTP details and makes later provider expansion harder.

### 2. Only support `chat/completions`

Rejected because the requested compatibility target explicitly includes both `responses` and `chat/completions`.

### 3. Global environment-variable relay config

Rejected because the requirement is per-capacity configuration, and capacity pooling already models provider/model availability at record granularity.

## Data Model

### ProviderCapacity

`ProviderCapacity` should become the source of truth for relay connection info.

Existing model fields remain:

- `id`
- `provider`
- `model`
- concurrency/rate/budget fields
- `enabled`
- `priority`

Connection fields should be:

- `baseUrl: string`
- `apiKeySecretRef: string`
- `protocolMode: 'auto' | 'responses' | 'chat_completions'`

### Field Migration

The current `secretRef` field is too ambiguous once the record also stores relay endpoint information. The design chooses a rename in the domain/API surface to `apiKeySecretRef`.

If the Prisma layer currently persists `secretRef`, implementation may either:

1. rename the stored field, if the migration is cheap and local, or
2. keep the persisted column temporarily but expose it as `apiKeySecretRef` in domain/API code

The external behavior must settle on `apiKeySecretRef`; the API should not expose both names long-term.

## Invocation Architecture

### Capacity Selection

Capacity selection remains unchanged conceptually:

1. `agent-runtime` asks the capacity service for a lease using `provider + model`
2. the selected key corresponds to one `ProviderCapacity` record
3. the model invocation layer reads full connection settings from that selected capacity record

### New Gateway Client

Add an OpenAI-compatible client in `packages/llm-gateway` that accepts:

- `baseUrl`
- `apiKey`
- `model`
- `protocolMode`
- prompt text

It returns the normalized internal shape:

- `rawOutput`
- `parsedOutput`
- `tokenUsage`

### Protocol Modes

#### `responses`

Send requests to:

- `POST {baseUrl}/responses`

Parse returned text/content and usage into the internal normalized result.

#### `chat_completions`

Send requests to:

- `POST {baseUrl}/chat/completions`

Parse the first assistant message content and usage into the internal normalized result.

#### `auto`

Attempt in this order:

1. `/responses`
2. `/chat/completions`

Fallback is allowed only when the first path clearly indicates incompatibility, such as:

- `404`
- `405`
- response schema incompatible with the expected `responses` shape

Fallback is **not** allowed for generic transport or auth failures such as:

- `401`
- `403`
- `429`
- `5xx`

Those should fail immediately because retrying a different protocol would hide real operator/configuration problems.

## Response Normalization

Both protocols must normalize into the same internal result contract.

### `rawOutput`

`rawOutput` stores the extracted assistant text actually returned to the agent layer.

### `parsedOutput`

Keep current behavior:

- if the caller/parser produces structured output, store it
- otherwise store `null`

This design does not introduce schema-constrained structured parsing at the transport layer.

### `tokenUsage`

Normalize to:

- `promptTokens`
- `completionTokens`
- `totalTokens`

If the upstream protocol omits usage, default to zeros rather than fabricating partial counts.

## Runtime Boundary

`packages/agent-runtime` should continue to depend on a model-invocation function and should not learn:

- endpoint paths
- protocol differences
- relay fallback policy
- OpenAI-specific response parsing

The runtime may need a slightly richer dependency to receive resolved provider connection info, but the protocol handling stays in `packages/llm-gateway`.

## API Changes

### `POST /provider-capacity`

The route must accept and validate:

- `baseUrl`
- `apiKeySecretRef`
- `protocolMode`

Validation rules:

- `baseUrl` must be a non-empty string
- `apiKeySecretRef` must be a non-empty string
- `protocolMode` must be one of `auto`, `responses`, `chat_completions`

The old `secretRef` request field should stop being the primary public API contract once this lands.

## Error Handling

Errors must remain explicit and attributable.

### Capacity Errors

If no capacity is available for `provider/model`, keep the current explicit failure behavior.

### Upstream HTTP Errors

Include enough context in the thrown error or saved agent-run message to identify:

- provider
- model
- base URL
- protocol mode
- upstream status code when available

### Schema Errors

If a relay returns a malformed payload:

- `responses` mode should fail explicitly
- `chat_completions` mode should fail explicitly
- `auto` mode may fallback only from `responses` incompatibility into `chat/completions`, then fail if that also does not match

## Testing Strategy

### Storage / Types

Add tests for the expanded `ProviderCapacity` contract and repository persistence.

### API

Extend `provider-capacity` route tests to validate the new fields and reject invalid `protocolMode`.

### Gateway

Add focused tests for:

- successful `/responses` invocation
- successful `/chat/completions` invocation
- `auto` falling back from unsupported `/responses` to `/chat/completions`
- auth/transport errors not triggering fallback
- malformed payloads failing explicitly

### Runtime

Add tests proving the runtime can run through a third-party OpenAI-compatible configuration without embedding transport logic in runtime code.

### Integration Boundaries

Use mocked `fetch`; do not depend on live external relay services in repository tests.

## Files Likely To Change

- `packages/domain/src/provider-capacity.ts`
- `packages/domain/src/index.ts`
- `packages/llm-gateway/src/*`
- `packages/agent-runtime/src/agent-runner.ts`
- `packages/storage/src/repositories/provider-capacity-repository.ts`
- `apps/api/src/routes/provider-capacity.ts`
- `apps/api/src/routes/validation.ts`
- related tests in `tests/api`, `tests/storage`, `tests/llm-gateway`, and `tests/agent-runtime`

## Success Criteria

The feature is complete when:

- a `ProviderCapacity` can persist `baseUrl`, `apiKeySecretRef`, and `protocolMode`
- the system can invoke a third-party OpenAI-compatible relay through either protocol
- `auto` fallback works only for true protocol incompatibility
- runtime remains protocol-agnostic
- all added behavior is covered by automated tests

## Intentional Non-Goals

- no custom headers
- no org/account routing metadata
- no provider-specific query parameters
- no speculative support for other non-OpenAI protocols
