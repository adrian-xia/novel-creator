import type { JsonObject, JsonValue, PromptConfig, ProviderCapacity } from '../../../../packages/domain/src';

type PromptPayload = Omit<PromptConfig, 'id'>;
type ProviderCapacityPayload = Omit<ProviderCapacity, 'id'>;
type DecisionMessagePayload = {
  content: string;
};
type ReplanRangePayload = {
  startChapter: number;
  endChapter: number;
};
type DecisionResolutionPayload = {
  resolutionType: 'accept_current' | 'accept_alternative' | 'replan_required' | 'pause_project';
  decisionSummary: string;
  storyFactsToApply: string[];
  chapterPlanAdjustments: string[];
  volumeImpact: string | null;
  nextAction: 'resume_current_chapter' | 'replan_window' | 'pause_project';
  replanRange: ReplanRangePayload | null;
  resumeFromChapter: number | null;
  invalidateExistingPlans: boolean;
};
type DecisionResolutionDraftPayload = {
  resolutionType: 'accept_current' | 'accept_alternative' | 'replan_required' | 'pause_project';
  decisionSummary: string;
  storyFactsToApply: string[];
  chapterPlanAdjustments: string[];
  volumeImpact: string | null;
  replanRange: ReplanRangePayload | null;
};
type PublishProfilePayload = {
  publishEnabled: boolean;
  autoPublishTargets: string[];
  manualExportTargets: string[];
  defaultExportFormat: 'plain_text' | 'markdown' | 'bundle';
  effectiveFromChapter: number | null;
};

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

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return isString(value) && allowed.includes(value as T);
}

function parseReplanRange(value: unknown): ReplanRangePayload | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const { startChapter, endChapter } = value;

  if (!isNumber(startChapter) || !isNumber(endChapter)) {
    return null;
  }

  if (startChapter < 1 || endChapter < startChapter) {
    return null;
  }

  return { startChapter, endChapter };
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

export function parseDecisionMessagePayload(value: unknown): DecisionMessagePayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const { role, messageType, content } = value;

  if (
    !isString(content) ||
    content.trim().length === 0
  ) {
    return null;
  }

  if (
    (role !== undefined && role !== 'human') ||
    (messageType !== undefined && messageType !== 'human')
  ) {
    return null;
  }

  return { content };
}

export function parseDecisionResolutionDraftPayload(
  value: unknown
): DecisionResolutionDraftPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    resolutionType,
    decisionSummary,
    storyFactsToApply,
    chapterPlanAdjustments,
    volumeImpact,
    replanRange
  } = value;

  if (
    !isOneOf(
      resolutionType,
      ['accept_current', 'accept_alternative', 'replan_required', 'pause_project'] as const
    ) ||
    !isString(decisionSummary) ||
    decisionSummary.trim().length === 0 ||
    !Array.isArray(storyFactsToApply) ||
    !storyFactsToApply.every(isString) ||
    !Array.isArray(chapterPlanAdjustments) ||
    !chapterPlanAdjustments.every(isString)
  ) {
    return null;
  }

  if (volumeImpact !== null && volumeImpact !== undefined && !isString(volumeImpact)) {
    return null;
  }

  const parsedReplanRange = parseReplanRange(replanRange);

  if ((replanRange !== null && replanRange !== undefined && parsedReplanRange === null) ||
      (resolutionType === 'replan_required' && parsedReplanRange === null)) {
    return null;
  }

  if (resolutionType === 'pause_project' && parsedReplanRange !== null) {
    return null;
  }

  return {
    resolutionType,
    decisionSummary,
    storyFactsToApply,
    chapterPlanAdjustments,
    volumeImpact: volumeImpact ?? null,
    replanRange: parsedReplanRange
  };
}

export function parseDecisionResolutionPayload(value: unknown): DecisionResolutionPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    resolutionType,
    decisionSummary,
    storyFactsToApply,
    chapterPlanAdjustments,
    volumeImpact,
    nextAction,
    replanRange,
    resumeFromChapter,
    invalidateExistingPlans
  } = value;

  if (
    !isOneOf(
      resolutionType,
      ['accept_current', 'accept_alternative', 'replan_required', 'pause_project'] as const
    ) ||
    !isString(decisionSummary) ||
    decisionSummary.trim().length === 0 ||
    !Array.isArray(storyFactsToApply) ||
    !storyFactsToApply.every(isString) ||
    !Array.isArray(chapterPlanAdjustments) ||
    !chapterPlanAdjustments.every(isString) ||
    !isOneOf(nextAction, ['resume_current_chapter', 'replan_window', 'pause_project'] as const) ||
    !isBoolean(invalidateExistingPlans)
  ) {
    return null;
  }

  if (volumeImpact !== null && volumeImpact !== undefined && !isString(volumeImpact)) {
    return null;
  }

  if (resumeFromChapter !== null && resumeFromChapter !== undefined && !isNumber(resumeFromChapter)) {
    return null;
  }

  const parsedReplanRange = parseReplanRange(replanRange);

  if (replanRange !== null && replanRange !== undefined && parsedReplanRange === null) {
    return null;
  }

  if (resolutionType === 'replan_required' && parsedReplanRange === null) {
    return null;
  }

  if (nextAction === 'replan_window' && parsedReplanRange === null) {
    return null;
  }

  if (nextAction !== 'replan_window' && parsedReplanRange !== null) {
    return null;
  }

  if (nextAction === 'pause_project' && resolutionType !== 'pause_project') {
    return null;
  }

  if (nextAction === 'resume_current_chapter' && resolutionType === 'pause_project') {
    return null;
  }

  if (
    parsedReplanRange !== null &&
    (resumeFromChapter === null ||
      resumeFromChapter < parsedReplanRange.startChapter ||
      resumeFromChapter > parsedReplanRange.endChapter)
  ) {
    return null;
  }

  if (parsedReplanRange === null && resumeFromChapter !== null) {
    return null;
  }

  if (invalidateExistingPlans !== (parsedReplanRange !== null)) {
    return null;
  }

  return {
    resolutionType,
    decisionSummary,
    storyFactsToApply,
    chapterPlanAdjustments,
    volumeImpact: volumeImpact ?? null,
    nextAction,
    replanRange: parsedReplanRange,
    resumeFromChapter: resumeFromChapter ?? null,
    invalidateExistingPlans
  };
}

export function parsePublishProfilePayload(value: unknown): PublishProfilePayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const {
    publishEnabled,
    autoPublishTargets,
    manualExportTargets,
    defaultExportFormat,
    effectiveFromChapter
  } = value;

  if (
    !isBoolean(publishEnabled) ||
    !Array.isArray(autoPublishTargets) ||
    !autoPublishTargets.every(isString) ||
    !Array.isArray(manualExportTargets) ||
    !manualExportTargets.every(isString) ||
    !isString(defaultExportFormat) ||
    !['plain_text', 'markdown', 'bundle'].includes(defaultExportFormat)
  ) {
    return null;
  }

  if (effectiveFromChapter !== null && effectiveFromChapter !== undefined && !isNumber(effectiveFromChapter)) {
    return null;
  }

  return {
    publishEnabled,
    autoPublishTargets,
    manualExportTargets,
    defaultExportFormat: defaultExportFormat as 'plain_text' | 'markdown' | 'bundle',
    effectiveFromChapter: effectiveFromChapter ?? null
  };
}
