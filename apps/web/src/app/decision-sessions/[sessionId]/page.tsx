import React from 'react';
import { getDecisionSessionDetail } from '../../../lib/api';

export default async function DecisionSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const detail = await getDecisionSessionDetail(sessionId);

  return (
    <main>
      <h1>Decision Session</h1>
      <section>
        <h2>Session Status</h2>
        <p>Session: {detail.sessionId}</p>
        {detail.chapterNumber ? <p>Chapter: {detail.chapterNumber}</p> : null}
        {detail.status ? <p>Status: {detail.status}</p> : null}
        {detail.triggerReason ? <p>{detail.triggerReason}</p> : null}
      </section>
      <section>
        <h2>Decision Packet</h2>
        <pre>{JSON.stringify(detail.packet, null, 2)}</pre>
      </section>
      <section>
        <h2>Message History</h2>
        {detail.messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          <ol>
            {detail.messages.map((message, index) => (
              <li key={`${message.sequence ?? index}-${message.role}`}>
                <strong>{message.role}</strong>: {message.content}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h2>Draft Resolution</h2>
        {detail.currentDraftResolution ? (
          <pre>{JSON.stringify(detail.currentDraftResolution, null, 2)}</pre>
        ) : (
          <p>No draft resolution yet.</p>
        )}
      </section>
      <section>
        <h2>Controls</h2>
        {detail.confirmation ? (
          <>
            <p>Confirmation required: {detail.confirmation.required ? 'yes' : 'no'}</p>
            <p>Request type: {detail.confirmation.requestType}</p>
          </>
        ) : (
          <p>No pending confirmation request.</p>
        )}
      </section>
      <section>
        <h2>Resolution</h2>
        {detail.resolution ? (
          <pre>{JSON.stringify(detail.resolution, null, 2)}</pre>
        ) : (
          <p>Not resolved yet.</p>
        )}
      </section>
    </main>
  );
}
