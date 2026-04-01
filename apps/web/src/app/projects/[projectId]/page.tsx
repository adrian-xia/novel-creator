import React from 'react';
import { getProjectProductionDetail } from '../../../lib/api';

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const detail = await getProjectProductionDetail(projectId);

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
    </main>
  );
}
