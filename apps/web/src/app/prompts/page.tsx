import React from 'react';
import { listPromptConfigs } from '../../lib/api';

export default async function PromptsPage() {
  const { items } = await listPromptConfigs();

  return (
    <main>
      <h1>Agent Prompts</h1>
      <p>Bootstrap the default prompt catalog or inspect the currently persisted prompt configs.</p>
      <form action="/prompts/bootstrap" method="post">
        <button type="submit">Bootstrap Default Prompts</button>
      </form>
      <section>
        <h2>Prompt Catalog</h2>
        <ul>
          {items.map((prompt) => (
            <li key={prompt.id}>
              <strong>{prompt.agentName}</strong>
              {' '}
              v{prompt.version}
              {' '}
              ({prompt.enabled ? 'enabled' : 'disabled'})
              {prompt.lastTestedModel ? ` - tested with ${prompt.lastTestedModel}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
