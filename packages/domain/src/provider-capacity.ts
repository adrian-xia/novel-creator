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
