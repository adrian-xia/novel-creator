import { createProjectFlow, enqueueWorkflow } from '../../../../packages/workflows/src';

export async function runWorkflowJob(jobName: string) {
  const flow = jobName === 'create-project-flow'
    ? createProjectFlow()
    : { name: jobName, steps: [] };

  return enqueueWorkflow(flow);
}
