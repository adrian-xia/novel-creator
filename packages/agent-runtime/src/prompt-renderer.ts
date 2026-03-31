export function renderPrompt(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, value);
  }, template);
}
