import type { ExecutableWorkflow } from './workflow-runtime';

export interface EnqueuedWorkflow {
  flowName: string;
  status: 'queued';
  steps: string[];
}

export function enqueueWorkflow<TPayload, TContext>(flow: ExecutableWorkflow<TPayload, TContext>) {
  return {
    flowName: flow.name,
    status: 'queued' as const,
    steps: flow.steps.map((step) => step.name)
  } satisfies EnqueuedWorkflow;
}
