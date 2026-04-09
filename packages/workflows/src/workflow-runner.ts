import { WorkflowRunRepository } from '../../storage/src/repositories/workflow-run-repository';
import type { WorkflowDeps } from './workflow-deps';
import type { ExecutableWorkflow } from './workflow-runtime';

export async function runInstrumentedWorkflow<TPayload, TContext>(input: {
  flow: ExecutableWorkflow<TPayload, TContext>;
  payload: TPayload & { projectId: string; chapterNumber: number | null };
  deps: WorkflowDeps;
}) {
  const repository = new WorkflowRunRepository();
  const run = await repository.createRun({
    flowName: input.flow.name,
    projectId: input.payload.projectId,
    chapterNumber: input.payload.chapterNumber
  });

  let context: TContext;
  try {
    context = input.flow.buildInitialContext(input.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    await repository.markRunFailed(run.id, message);
    throw error;
  }

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
