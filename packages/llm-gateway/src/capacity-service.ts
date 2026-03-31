import { ProviderRegistry, type CapacityKey } from './provider-registry';

export type { CapacityKey } from './provider-registry';

export interface AcquireRequest {
  provider: string;
  model: string;
}

export interface CapacityLease {
  keyId: string;
}

export class CapacityService {
  private readonly registry: ProviderRegistry;

  constructor(keys: CapacityKey[], registry: ProviderRegistry = new ProviderRegistry(keys)) {
    this.registry = registry;
  }

  async acquire(request: AcquireRequest): Promise<CapacityLease> {
    const candidate = this.registry.selectAvailable(request);

    if (!candidate) {
      throw new Error(`No capacity for ${request.provider}/${request.model}`);
    }

    candidate.currentLeases += 1;
    return { keyId: candidate.id };
  }

  async release(lease: CapacityLease): Promise<void> {
    const key = this.registry.findById(lease.keyId);

    if (!key || key.currentLeases < 1) {
      throw new Error(`Lease not found for ${lease.keyId}`);
    }

    key.currentLeases -= 1;
  }
}
