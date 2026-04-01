import React from 'react';
import { getPublishCenter } from '../../lib/api';

export default async function PublishCenterPage() {
  const detail = await getPublishCenter();

  return (
    <main>
      <h1>Publish Center</h1>
      <section>
        <h2>Tasks</h2>
        <pre>{JSON.stringify(detail.tasks, null, 2)}</pre>
      </section>
      <section>
        <h2>Artifacts</h2>
        <pre>{JSON.stringify(detail.artifacts, null, 2)}</pre>
      </section>
    </main>
  );
}
