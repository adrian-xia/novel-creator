import type { WorkflowDeps } from './workflow-deps';

export interface WorkflowStep<TContext, TDeps = WorkflowDeps> {
  name: string;
  run: (context: TContext, deps: TDeps) => Promise<TContext>;
}

export interface ExecutableWorkflow<TPayload, TContext, TDeps = WorkflowDeps> {
  name: string;
  buildInitialContext: (payload: TPayload) => TContext;
  steps: Array<WorkflowStep<TContext, TDeps>>;
}
