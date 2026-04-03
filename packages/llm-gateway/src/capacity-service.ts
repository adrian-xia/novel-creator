import { ProviderRegistry, type CapacityKey } from './provider-registry';

export type { CapacityKey } from './provider-registry';

export interface AcquireRequest {
  provider: string;
  model: string;
}

export interface CapacityLease {
  keyId: string;
  leaseId: string;
  baseUrl: string;
  apiKeySecretRef: string;
  protocolMode: 'auto' | 'responses' | 'chat_completions';
}

export class CapacityService {
  private readonly registry: ProviderRegistry;
  private readonly activeLeases = new Map<string, string>();
  private nextLeaseId = 1;

  constructor(keys: CapacityKey[], registry: ProviderRegistry = new ProviderRegistry(keys)) {
    this.registry = registry;
  }

  async acquire(request: AcquireRequest): Promise<CapacityLease> {
    const candidate = this.registry.selectAvailable(request.provider, request.model);

    if (!candidate) {
      throw new Error(`No capacity for ${request.provider}/${request.model}`);
    }

    candidate.currentLeases += 1;
    const leaseId = `lease-${this.nextLeaseId++}`;
    this.activeLeases.set(leaseId, candidate.id);
    return {
      keyId: candidate.id,
      leaseId,
      baseUrl: candidate.baseUrl,
      apiKeySecretRef: candidate.apiKeySecretRef,
      protocolMode: candidate.protocolMode
    };
  }

  async release(lease: CapacityLease): Promise<void> {
    const leasedKeyId = this.activeLeases.get(lease.leaseId);
    const key = this.registry.findById(lease.keyId);

    if (!key || key.currentLeases < 1 || leasedKeyId !== lease.keyId) {
      throw new Error(`Lease not found for ${lease.keyId}`);
    }

    this.activeLeases.delete(lease.leaseId);
    key.currentLeases -= 1;
  }
}
