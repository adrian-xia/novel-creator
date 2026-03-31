import type { ProviderCapacity } from '../../domain/src/provider-capacity';

export type CapacityKey = ProviderCapacity & {
  currentLeases: number;
};

export class ProviderRegistry {
  constructor(private readonly keys: CapacityKey[]) {}

  list(): CapacityKey[] {
    return [...this.keys];
  }

  find(provider: string, model: string): CapacityKey[] {
    return this.keys.filter((key) => key.provider === provider && key.model === model);
  }

  findById(keyId: string): CapacityKey | undefined {
    return this.keys.find((key) => key.id === keyId);
  }

  selectAvailable(provider: string, model: string): CapacityKey | undefined {
    return this.find(provider, model)
      .filter((key) => key.enabled)
      .filter((key) => key.currentLeases < key.maxConcurrentRequests)
      .sort((left, right) => right.priority - left.priority)[0];
  }
}
