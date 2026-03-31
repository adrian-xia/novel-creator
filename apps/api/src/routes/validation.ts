import type { JsonObject, JsonValue, PromptConfig, ProviderCapacity } from '../../../../packages/domain/src';

type PromptPayload = Omit<PromptConfig, 'id'>;
type ProviderCapacityPayload = Omit<ProviderCapacity, 'id'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function parsePromptPayload(value: unknown): PromptPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    agentName,
    version,
    systemPrompt,
    taskTemplate,
    outputSchema,
    reviewRubric,
    enabled,
    lastTestedModel
  } = value;

  if (
    !isString(agentName) ||
    !isNumber(version) ||
    !isString(systemPrompt) ||
    !isString(taskTemplate) ||
    !isJsonObject(outputSchema) ||
    !isBoolean(enabled)
  ) {
    return null;
  }

  if (reviewRubric !== undefined && !isString(reviewRubric)) {
    return null;
  }

  if (lastTestedModel !== undefined && !isString(lastTestedModel)) {
    return null;
  }

  return {
    agentName,
    version,
    systemPrompt,
    taskTemplate,
    outputSchema,
    reviewRubric,
    enabled,
    lastTestedModel
  };
}

export function parseProviderCapacityPayload(value: unknown): ProviderCapacityPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    provider,
    model,
    keyName,
    secretRef,
    maxConcurrentRequests,
    requestsPerMinute,
    tokensPerMinute,
    dailyBudget,
    enabled,
    priority
  } = value;

  if (
    !isString(provider) ||
    !isString(model) ||
    !isString(keyName) ||
    !isString(secretRef) ||
    !isNumber(maxConcurrentRequests) ||
    !isNumber(requestsPerMinute) ||
    !isNumber(tokensPerMinute) ||
    !isString(dailyBudget) ||
    !isBoolean(enabled) ||
    !isNumber(priority)
  ) {
    return null;
  }

  return {
    provider,
    model,
    keyName,
    secretRef,
    maxConcurrentRequests,
    requestsPerMinute,
    tokensPerMinute,
    dailyBudget,
    enabled,
    priority
  };
}
