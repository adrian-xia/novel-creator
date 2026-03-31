import type { CapacityKey } from './capacity-service';

export class ProviderRegistry {
  constructor(private readonly keys: CapacityKey[]) {}

  list(): CapacityKey[] {
    return [...this.keys];
  }

  find(provider: string, model: string): CapacityKey[] {
    return this.keys.filter((key) => key.provider === provider && key.model === model);
  }
}
