import type { ExecutableWorkflow } from './workflow-runtime';

export function enqueueWorkflow<TPayload, TContext>(flow: ExecutableWorkflow<TPayload, TContext>) {
  return {
    flowName: flow.name,
    status: 'queued' as const,
    steps: flow.steps.map((step) => step.name)
  };
}
