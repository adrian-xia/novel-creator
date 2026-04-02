import React from 'react';
import { getDecisionQueue } from '../../lib/api';

export default async function DecisionQueuePage() {
  const queue = await getDecisionQueue();

  return (
    <main>
      <h1>Decision Queue</h1>
      {queue.items.length === 0 ? (
        <p>No open decision sessions.</p>
      ) : (
        <ul>
          {queue.items.map((item) => (
            <li key={item.sessionId}>
              <a href={`/decision-sessions/${item.sessionId}`}>{item.sessionId}</a>
              <div>Project: {item.projectId}</div>
              <div>Chapter: {item.chapterNumber}</div>
              <div>Status: {item.status}</div>
              <div>{item.triggerReason ?? 'No trigger reason provided.'}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
