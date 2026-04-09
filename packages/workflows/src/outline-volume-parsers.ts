function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => isRecord(item));
}

export function parseOutlineOutput(output: Record<string, unknown> | null) {
  if (!output || typeof output.title !== 'string') {
    throw new Error('Invalid outline output: missing title');
  }

  return {
    outline: output,
    storyBible: typeof output.storyBible === 'string' ? output.storyBible : null
  };
}

export function parseVolumeOutput(output: Record<string, unknown> | null) {
  const plans =
    (isRecordArray(output?.plans) && output.plans) ||
    (isRecordArray(output?.volumePlans) && output.volumePlans);

  if (!plans) {
    throw new Error('Invalid volume output: missing plans');
  }

  return {
    plans
  };
}
