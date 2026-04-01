import React from 'react';
import { getWorkflowRunDetail } from '../../../lib/api';

export default async function WorkflowRunDetailPage({
  params
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const detail = await getWorkflowRunDetail(runId);

  return (
    <main>
      <h1>Run Detail</h1>
      <pre>{JSON.stringify(detail, null, 2)}</pre>
    </main>
  );
}
