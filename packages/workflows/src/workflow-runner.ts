import { WorkflowRunRepository } from '../../storage/src/repositories/workflow-run-repository';
import { isHumanGateRequestedError } from './human-gate';
import type { WorkflowDeps } from './workflow-deps';
import type { ExecutableWorkflow } from './workflow-runtime';

export async function runInstrumentedWorkflow<TPayload, TContext>(input: {
  flow: ExecutableWorkflow<TPayload, TContext>;
  payload: TPayload & { projectId: string; chapterNumber: number | null };
  deps: WorkflowDeps;
}): Promise<TContext & { waitingForHumanGate?: string }> {
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
      if (isHumanGateRequestedError(error)) {
        const pausedContext = (error.context ?? context) as TContext;
        await repository.markStepSucceeded(run.id, step.name);
        await repository.markRunWaitingForHumanGate(run.id, error.sessionId);
        return {
          ...(pausedContext as object),
          waitingForHumanGate: error.sessionId
        } as TContext & { waitingForHumanGate: string };
      }

      const message = error instanceof Error ? error.message : 'unknown error';
      await repository.markStepFailed(run.id, step.name, message);
      await repository.markRunFailed(run.id, message);
      throw error;
    }
  }

  await repository.markRunSucceeded(run.id);
  return context;
}
