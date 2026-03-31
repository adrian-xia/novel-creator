export interface ProviderCapacity {
  id: string;
  provider: string;
  model: string;
  keyName: string;
  secretRef: string;
  maxConcurrentRequests: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  dailyBudget: string;
  enabled: boolean;
  priority: number;
}
