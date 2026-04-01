import { WorkflowRunRepository } from '../../storage/src/repositories/workflow-run-repository';
import type { WorkflowDefinition } from './create-project-flow';

export async function runInstrumentedWorkflow(input: {
  flow: WorkflowDefinition;
  payload: { projectId: string; chapterNumber: number | null };
}) {
  const repository = new WorkflowRunRepository();
  const run = await repository.createRun({
    flowName: input.flow.name,
    projectId: input.payload.projectId,
    chapterNumber: input.payload.chapterNumber
  });

  for (const step of input.flow.steps) {
    await repository.markStepRunning(run.id, step);
    await repository.markStepSucceeded(run.id, step);
  }

  await repository.markRunSucceeded(run.id);

  return {
    flowName: input.flow.name,
    stepCount: input.flow.steps.length
  };
}
