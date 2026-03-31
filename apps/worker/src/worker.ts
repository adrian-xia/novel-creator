import { runWorkflowJob } from './jobs/workflow-job';

export async function startWorker(jobName: string) {
  return runWorkflowJob(jobName);
}
