const activeProjectLocks = new Set<string>();

export async function acquireChapterPipelineLock(projectId: string) {
  if (activeProjectLocks.has(projectId)) {
    throw new Error(`Project chapter pipeline already active for ${projectId}`);
  }

  activeProjectLocks.add(projectId);
}

export async function releaseChapterPipelineLock(projectId: string) {
  activeProjectLocks.delete(projectId);
}
