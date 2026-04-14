import { describe, expect, it } from 'vitest';

describe('structured output parsing', () => {
  it('parses a plain JSON object string', async () => {
    const { parseStructuredJsonOutput } = await import(
      '../../packages/workflows/src/structured-output'
    );

    expect(
      parseStructuredJsonOutput('{"title":"第一章","goal":"建立冲突"}')
    ).toEqual({
      title: '第一章',
      goal: '建立冲突'
    });
  });

  it('parses a fenced json code block', async () => {
    const { parseStructuredJsonOutput } = await import(
      '../../packages/workflows/src/structured-output'
    );

    expect(
      parseStructuredJsonOutput('```json\n{"title":"第一章","goal":"建立冲突"}\n```')
    ).toEqual({
      title: '第一章',
      goal: '建立冲突'
    });
  });

  it('returns null when the content is not a JSON object', async () => {
    const { parseStructuredJsonOutput } = await import(
      '../../packages/workflows/src/structured-output'
    );

    expect(parseStructuredJsonOutput('not json')).toBeNull();
    expect(parseStructuredJsonOutput('["a","b"]')).toBeNull();
  });
});
