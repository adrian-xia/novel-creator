export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface PromptConfig {
  id: string;
  agentName: string;
  version: number;
  systemPrompt: string;
  taskTemplate: string;
  outputSchema: JsonObject;
  reviewRubric?: string;
  enabled: boolean;
  lastTestedModel?: string;
}
