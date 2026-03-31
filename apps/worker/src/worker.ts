import { runWorkflowJob } from './jobs/workflow-job';

export async function startWorker(jobName = 'create-project-flow') {
  return runWorkflowJob(jobName);
}
