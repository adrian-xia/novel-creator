export async function getJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

async function postJson<T>(input: RequestInfo | URL, body: unknown): Promise<T> {
  const response = await fetch(input, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

type DecisionQueueItem = {
  sessionId: string;
  projectId: string;
  chapterNumber: number | null;
  status: string;
  triggerReason: string | null;
  updatedAt: string;
  gateType: string | null;
  recommendedOptionId: string | null;
  selectedOptionId: string | null;
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
  chapterNumber?: number | null;
  status?: string;
  triggerReason?: string | null;
  updatedAt?: string;
  gateType?: string | null;
  options?: Array<{
    optionId: string;
    title: string;
    strategy: string;
    rationale: string;
    impactSummary: string;
    patch: Record<string, unknown>;
  }>;
  recommendedOptionId?: string | null;
  selectedOptionId?: string | null;
  humanNotes?: string | null;
  packet: Record<string, unknown>;
  messages: DecisionSessionMessage[];
  resolution: Record<string, unknown> | null;
  currentDraftResolution?: Record<string, unknown> | null;
  confirmation?: {
    required: boolean;
    requestType: string;
  } | null;
};

type DecisionSessionNotFound = {
  message: string;
};

type DecisionSessionMessageInput = {
  content: string;
};

type DecisionResolutionDraftInput = {
  resolutionType: 'accept_current' | 'accept_alternative' | 'replan_required' | 'pause_project';
  decisionSummary: string;
  storyFactsToApply: string[];
  chapterPlanAdjustments: string[];
  volumeImpact: string | null;
  replanRange: {
    startChapter: number;
    endChapter: number;
  } | null;
};

type DecisionResolutionInput = DecisionResolutionDraftInput & {
  nextAction: 'resume_current_chapter' | 'replan_window' | 'pause_project';
  resumeFromChapter: number | null;
  invalidateExistingPlans: boolean;
};

type DecisionSessionMessageResponse = {
  sessionId: string;
  status: string;
  appendedMessage: Record<string, unknown>;
  assistantWork: Record<string, unknown>;
};

type HumanGateConfirmationResponse = {
  sessionId: string;
  status: string;
  selectedOptionId: string | null;
  humanNotes: string | null;
  nextWork?: {
    workflowRunId: string;
    flowName: string;
    status: string;
    steps: string[];
    autoEnqueued: boolean;
  };
};

type HumanGateCancellationResponse = {
  sessionId: string;
  status: string;
};

type DecisionResolutionDraftResponse = {
  sessionId: string;
  status: string;
  resolution: Record<string, unknown>;
  confirmation: {
    required: boolean;
    requestType: string;
  };
};

type DecisionResolutionResponse = {
  sessionId: string;
  status: string;
  resolution: Record<string, unknown>;
  recoveryWork:
    | {
        workflowRunId: string;
        flowName: string;
        status: string;
        steps: string[];
        autoEnqueued: boolean;
      }
    | null;
};

type PublishTask = {
  id: string;
  targetPlatform: string;
  status: string;
};

type PublishArtifact = {
  id: string;
  targetPlatform: string;
  format: string;
};

type PublishTasksResponse = {
  items: PublishTask[];
  artifacts: PublishArtifact[];
};

type ExportFormat = 'plain_text' | 'markdown' | 'bundle';

type ExportableChapter = {
  projectId: string;
  chapterNumber: number;
  title: string;
  summary: string;
  updatedAt: string;
};

type ExportPreview = Record<string, unknown>;

export async function getProjectProductionDetail(projectId: string) {
  return getJson<{
    projectId: string;
    outline: Record<string, unknown> | null;
    volumePlans: Array<Record<string, unknown>>;
    chapters: Array<{
      chapterNumber: number;
      status: string;
      latestReviewDecision: string | null;
    }>;
    recentAgentRuns: Array<Record<string, unknown>>;
    publishProfile: {
      publishEnabled: boolean;
      autoPublishTargets: string[];
      manualExportTargets: string[];
      defaultExportFormat: ExportFormat;
      effectiveFromChapter: number | null;
    };
  }>(`${API_BASE_URL}/projects/${projectId}`);
}

export async function getDecisionQueue() {
  return getJson<DecisionQueueResponse>(`${API_BASE_URL}/decision-sessions`);
}

export async function getDecisionSessionDetail(sessionId: string) {
  return getJson<DecisionSessionDetail | DecisionSessionNotFound>(
    `${API_BASE_URL}/decision-sessions/${sessionId}`
  );
}

export async function createDecisionMessage(
  sessionId: string,
  payload: DecisionSessionMessageInput
) {
  return postJson<DecisionSessionMessageResponse>(
    `${API_BASE_URL}/decision-sessions/${sessionId}/messages`,
    payload
  );
}

export async function generateDecisionResolutionDraft(
  sessionId: string,
  payload: DecisionResolutionDraftInput
) {
  return postJson<DecisionResolutionDraftResponse>(
    `${API_BASE_URL}/decision-sessions/${sessionId}/generate-resolution`,
    payload
  );
}

export async function confirmDecisionResolution(
  sessionId: string,
  payload: DecisionResolutionInput
) {
  return postJson<DecisionResolutionResponse>(
    `${API_BASE_URL}/decision-sessions/${sessionId}/resolve`,
    payload
  );
}

export async function confirmHumanGate(
  sessionId: string,
  payload: { selectedOptionId: string; humanNotes: string | null }
) {
  return postJson<HumanGateConfirmationResponse>(
    `${API_BASE_URL}/decision-sessions/${sessionId}/confirm`,
    payload
  );
}

export async function cancelHumanGate(sessionId: string) {
  return postJson<HumanGateCancellationResponse>(
    `${API_BASE_URL}/decision-sessions/${sessionId}/cancel`,
    {}
  );
}

export async function getPublishCenter() {
  const response = await getJson<PublishTasksResponse>(`${API_BASE_URL}/publish-tasks`);

  return {
    tasks: response.items,
    artifacts: response.artifacts
  };
}

export async function getExportableChapters(projectId: string) {
  return getJson<{ items: ExportableChapter[] }>(
    `${API_BASE_URL}/projects/${projectId}/exportable-chapters`
  );
}

export async function previewExportBatch(input: {
  projectId: string;
  chapterNumbers: number[];
  format: ExportFormat;
}) {
  const response = await fetch(`${API_BASE_URL}/projects/${input.projectId}/exports/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chapterNumbers: input.chapterNumbers,
      format: input.format
    })
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<ExportPreview>;
}

export async function getWorkflowRuns() {
  return getJson<{ items: Array<{ runId: string; flowName: string; status: string }> }>(
    `${API_BASE_URL}/workflow-runs`
  );
}

export async function getWorkflowRunDetail(runId: string) {
  return getJson<{
    runId: string;
    flowName: string;
    steps: Array<{ stepName: string; status: string }>;
  }>(`${API_BASE_URL}/workflow-runs/${runId}`);
}
