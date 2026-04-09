import { WorkflowRunRepository } from '../../storage/src/repositories/workflow-run-repository';
import type { ExecutableWorkflow } from './workflow-runtime';

export async function runInstrumentedWorkflow<TPayload, TContext, TDeps>(input: {
  flow: ExecutableWorkflow<TPayload, TContext, TDeps>;
  payload: TPayload & { projectId: string; chapterNumber: number | null };
  deps: TDeps;
}) {
  const repository = new WorkflowRunRepository();
  const run = await repository.createRun({
    flowName: input.flow.name,
    projectId: input.payload.projectId,
    chapterNumber: input.payload.chapterNumber
  });

  let context = input.flow.buildInitialContext(input.payload);

  for (const step of input.flow.steps) {
    await repository.markStepRunning(run.id, step.name);
    try {
      context = await step.run(context, input.deps);
      await repository.markStepSucceeded(run.id, step.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      await repository.markStepFailed(run.id, step.name, message);
      await repository.markRunFailed(run.id, message);
      throw error;
    }
  }

  await repository.markRunSucceeded(run.id);
  return context;
}
