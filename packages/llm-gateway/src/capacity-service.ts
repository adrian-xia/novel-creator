export interface CapacityKey {
  id: string;
  provider: string;
  model: string;
  priority: number;
  enabled: boolean;
  maxConcurrentRequests: number;
  currentLeases: number;
}

export interface AcquireRequest {
  provider: string;
  model: string;
}

export class CapacityService {
  constructor(private readonly keys: CapacityKey[]) {}

  async acquire(request: AcquireRequest): Promise<{ keyId: string }> {
    const candidate = this.keys
      .filter((key) => key.enabled)
      .filter((key) => key.provider === request.provider && key.model === request.model)
      .filter((key) => key.currentLeases < key.maxConcurrentRequests)
      .sort((left, right) => right.priority - left.priority)[0];

    if (!candidate) {
      throw new Error(`No capacity for ${request.provider}/${request.model}`);
    }

    candidate.currentLeases += 1;
    return { keyId: candidate.id };
  }
}
