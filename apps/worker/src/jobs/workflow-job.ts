export async function runWorkflowJob(jobName: string) {
  return {
    jobName,
    status: 'queued' as const
  };
}
