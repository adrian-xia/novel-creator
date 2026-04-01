import React from 'react';
import { getWorkflowRuns } from '../../lib/api';

export default async function WorkflowRunsPage() {
  const runs = await getWorkflowRuns();

  return (
    <main>
      <h1>Workflow Runs</h1>
      <pre>{JSON.stringify(runs.items, null, 2)}</pre>
    </main>
  );
}
