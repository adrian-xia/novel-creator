function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStoryBible(value: unknown): string | null {
  if (isNonEmptyString(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return null;
}

export function parseOutlineOutput(output: Record<string, unknown> | null) {
  if (!output || !isNonEmptyString(output.title)) {
    throw new Error('Invalid outline output: missing title');
  }

  const { storyBible, ...outline } = output;

  return {
    outline,
    storyBible: normalizeStoryBible(storyBible)
  };
}

export function parseVolumeOutput(output: Record<string, unknown> | null) {
  const planEntries = output?.plans ?? output?.volumePlans;

  if (!Array.isArray(planEntries) || planEntries.length === 0) {
    throw new Error('Invalid volume output: missing plans');
  }

  return {
    plans: planEntries.map((plan, index) => {
      if (!isRecord(plan)) {
        throw new Error(`Invalid volume output: plan ${index + 1} is not an object`);
      }

      const volumeNumber = 'volumeNumber' in plan ? plan.volumeNumber : index + 1;

      if (!Number.isInteger(volumeNumber) || volumeNumber < 1) {
        throw new Error(`Invalid volume output: plan ${index + 1} has invalid volumeNumber`);
      }

      if (
        !isNonEmptyString(plan.goal) &&
        !isNonEmptyString(plan.title) &&
        !isNonEmptyString(plan.name)
      ) {
        throw new Error(`Invalid volume output: plan ${index + 1} is missing a descriptive field`);
      }

      return {
        ...plan,
        volumeNumber
      };
    })
  };
}
