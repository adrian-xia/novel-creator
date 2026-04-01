import React from 'react';
import { getDecisionQueue } from '../../lib/api';

export default async function DecisionQueuePage() {
  const queue = await getDecisionQueue();

  return (
    <main>
      <h1>Decision Queue</h1>
      <pre>{JSON.stringify(queue.items, null, 2)}</pre>
    </main>
  );
}
