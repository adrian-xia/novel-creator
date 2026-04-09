import type { ExecutableWorkflow } from './workflow-runtime';

type EnqueueableWorkflow = ExecutableWorkflow<unknown, unknown, unknown>;

export function enqueueWorkflow(flow: EnqueueableWorkflow) {
  return {
    flowName: flow.name,
    status: 'queued' as const,
    steps: flow.steps.map((step) => step.name)
  };
}
