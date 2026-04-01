export async function getJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getProjectProductionDetail(projectId: string) {
  return {
    projectId,
    outline: null,
    volumePlans: [],
    chapters: [],
    recentAgentRuns: [],
    publishProfile: {
      publishEnabled: false,
      autoPublishTargets: [],
      manualExportTargets: [],
      defaultExportFormat: 'markdown',
      effectiveFromChapter: null
    }
  };
}

export async function getDecisionQueue() {
  return { items: [] as Array<Record<string, unknown>> };
}

export async function getDecisionSessionDetail(sessionId: string) {
  return {
    sessionId,
    packet: { riskAnalysis: 'too early' },
    messages: [{ role: 'assistant', content: 'delay the reveal' }],
    resolution: null
  };
}

export async function getPublishCenter() {
  return {
    tasks: [{ id: 'task-1', targetPlatform: 'alpha', status: 'published' }],
    artifacts: [{ id: 'artifact-1', targetPlatform: 'beta', format: 'bundle' }]
  };
}

export async function getWorkflowRuns() {
  return {
    items: [{ id: 'run-1', flowName: 'publish-chapter-flow', status: 'running' }]
  };
}

export async function getWorkflowRunDetail(runId: string) {
  return {
    runId,
    flowName: 'publish-chapter-flow',
    steps: [{ stepName: 'expand-publish-tasks', status: 'succeeded' }]
  };
}
