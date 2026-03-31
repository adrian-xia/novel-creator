import type { PromptConfig } from '../../packages/domain/src/prompt-config';

const outputSchema: PromptConfig['outputSchema'] = {
  type: 'object',
  properties: {
    title: {
      type: 'string'
    }
  }
};

const jsonObject: Record<string, unknown> = outputSchema;

void jsonObject;
