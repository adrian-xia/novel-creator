import { describe, expect, it } from 'vitest';
import { renderPrompt } from '../../packages/agent-runtime/src/prompt-renderer';

describe('prompt renderer', () => {
  it('replaces placeholders from the provided variables', () => {
    const rendered = renderPrompt('Hello {{name}}.', {
      name: 'Ari'
    });

    expect(rendered).toBe('Hello Ari.');
  });

  it('inserts variable values literally without re-expanding placeholder text', () => {
    const rendered = renderPrompt('Title: {{title}}', {
      title: '{{name}}',
      name: 'Ari'
    });

    expect(rendered).toBe('Title: {{name}}');
  });
});
