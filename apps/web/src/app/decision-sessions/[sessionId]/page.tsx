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
        <h2>Decision Packet</h2>
        <pre>{JSON.stringify(detail.packet, null, 2)}</pre>
      </section>
      <section>
        <h2>Conversation</h2>
        <pre>{JSON.stringify(detail.messages, null, 2)}</pre>
      </section>
      <section>
        <h2>Resolution</h2>
        <pre>{JSON.stringify(detail.resolution, null, 2)}</pre>
      </section>
    </main>
  );
}
