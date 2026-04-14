function toObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function stripJsonCodeFence(rawOutput: string): string {
  const trimmed = rawOutput.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (!fencedMatch) {
    return trimmed;
  }

  return fencedMatch[1]?.trim() ?? '';
}

export function parseStructuredJsonOutput(rawOutput: string): Record<string, unknown> | null {
  if (rawOutput.trim().length === 0) {
    return null;
  }

  const candidates = [rawOutput.trim(), stripJsonCodeFence(rawOutput)];

  for (const candidate of candidates) {
    if (candidate.length === 0) {
      continue;
    }

    try {
      const parsed = JSON.parse(candidate) as unknown;
      const objectValue = toObject(parsed);

      if (objectValue) {
        return objectValue;
      }
    } catch {
      continue;
    }
  }

  return null;
}
