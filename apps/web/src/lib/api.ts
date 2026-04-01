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
    recentAgentRuns: []
  };
}
