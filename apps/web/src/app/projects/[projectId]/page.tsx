import React from 'react';
import { getDecisionQueue, getProjectProductionDetail } from '../../../lib/api';

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [detail, queue] = await Promise.all([
    getProjectProductionDetail(projectId),
    getDecisionQueue()
  ]);
  const openDecisions = queue.items.filter((item) => item.projectId === projectId);

  return (
    <main>
      <h1>Story Production</h1>
      <section>
        <h2>Outline</h2>
        <pre>{JSON.stringify(detail.outline, null, 2)}</pre>
      </section>
      <section>
        <h2>Volumes</h2>
        <pre>{JSON.stringify(detail.volumePlans, null, 2)}</pre>
      </section>
      <section>
        <h2>Chapters</h2>
        <pre>{JSON.stringify(detail.chapters, null, 2)}</pre>
      </section>
      <section>
        <h2>Recent Agent Runs</h2>
        <pre>{JSON.stringify(detail.recentAgentRuns, null, 2)}</pre>
      </section>
      <section>
        <h2>Publish Profile</h2>
        <pre>{JSON.stringify(detail.publishProfile, null, 2)}</pre>
      </section>
      <section>
        <h2>Open Decisions</h2>
        {openDecisions.length === 0 ? (
          <p>No open decisions for this project.</p>
        ) : (
          <ul>
            {openDecisions.map((item) => (
              <li key={item.sessionId}>
                <a href={`/decision-sessions/${item.sessionId}`}>{item.sessionId}</a>
                <div>Chapter: {item.chapterNumber}</div>
                <div>Status: {item.status}</div>
                <div>{item.triggerReason ?? 'No trigger reason provided.'}</div>
              </li>
            ))}
          </ul>
        )}
        <p>
          <a href="/decision-sessions">View full decision queue</a>
        </p>
      </section>
      <nav>
        <a href="/decision-sessions">Decision Queue</a>
        <a href={`/publish?projectId=${projectId}`}>Publish Center</a>
        <a href="/runs">Workflow Runs</a>
      </nav>
    </main>
  );
}
