export interface WorkflowStep<TContext, TDeps> {
  name: string;
  run: (context: TContext, deps: TDeps) => Promise<TContext>;
}

export interface ExecutableWorkflow<TPayload, TContext, TDeps> {
  name: string;
  buildInitialContext: (payload: TPayload) => TContext;
  steps: Array<WorkflowStep<TContext, TDeps>>;
}
