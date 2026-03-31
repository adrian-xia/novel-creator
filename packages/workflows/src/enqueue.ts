import type { WorkflowDefinition } from './create-project-flow';

export function enqueueWorkflow(flow: WorkflowDefinition) {
  return {
    flowName: flow.name,
    status: 'queued' as const
  };
}
