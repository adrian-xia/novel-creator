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
              <div>Chapter: {item.chapterNumber ?? 'N/A'}</div>
              <div>Status: {item.status}</div>
              {item.gateType ? <div>Gate Type: {item.gateType}</div> : null}
              {item.recommendedOptionId ? (
                <div>Recommended Option: {item.recommendedOptionId}</div>
              ) : null}
              {item.selectedOptionId ? <div>Selected Option: {item.selectedOptionId}</div> : null}
              <div>{item.triggerReason ?? 'No trigger reason provided.'}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
