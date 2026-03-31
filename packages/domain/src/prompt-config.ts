export interface PromptConfig {
  id: string;
  agentName: string;
  version: number;
  systemPrompt: string;
  taskTemplate: string;
  outputSchema: unknown;
  reviewRubric?: string;
  enabled: boolean;
  lastTestedModel?: string;
}
