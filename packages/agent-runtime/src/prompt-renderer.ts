export function renderPrompt(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    return Object.hasOwn(variables, key) ? variables[key] : match;
  });
}
