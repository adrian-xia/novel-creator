export async function getJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

const API_BASE_URL = 'http://localhost:3000';

type DecisionQueueItem = {
  sessionId: string;
  projectId: string;
  chapterNumber: number;
  status: string;
  triggerReason: string | null;
  updatedAt: string;
};

type DecisionQueueResponse = {
  items: DecisionQueueItem[];
};

type DecisionSessionMessage = {
  sessionId?: string;
  sequence?: number;
  role: string;
  messageType?: string;
  content: string;
  createdAt?: string;
};

type DecisionSessionDetail = {
  sessionId: string;
  projectId?: string;
  chapterNumber?: number;
  status?: string;
  triggerReason?: string | null;
  updatedAt?: string;
  packet: Record<string, unknown>;
  messages: DecisionSessionMessage[];
  resolution: Record<string, unknown> | null;
  currentDraftResolution?: Record<string, unknown> | null;
  confirmation?: {
    required: boolean;
    requestType: string;
  } | null;
};

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
  return getJson<DecisionQueueResponse>(`${API_BASE_URL}/decision-sessions`);
}

export async function getDecisionSessionDetail(sessionId: string) {
  return getJson<DecisionSessionDetail>(`${API_BASE_URL}/decision-sessions/${sessionId}`);
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
