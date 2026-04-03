import type { FastifyInstance } from 'fastify';

type WorkflowRunSummary = {
  runId: string;
  flowName: string;
  projectId: string;
  chapterNumber: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkflowRunDetail = WorkflowRunSummary & {
  steps: Array<{
    workflowRunId: string;
    stepName: string;
    status: string;
    errorMessage: string | null;
    startedAt: string;
    updatedAt: string;
  }>;
};

function toIsoString(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? null;
}

function toWorkflowRunSummary(record: {
  id: string;
  flowName: string;
  projectId: string;
  chapterNumber: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): WorkflowRunSummary {
  return {
    runId: record.id,
    flowName: record.flowName,
    projectId: record.projectId,
    chapterNumber: record.chapterNumber,
    status: record.status,
    errorMessage: record.errorMessage,
    createdAt: toIsoString(record.createdAt) ?? '',
    updatedAt: toIsoString(record.updatedAt) ?? ''
  };
}

function toWorkflowRunDetail(record: {
  id: string;
  flowName: string;
  projectId: string;
  chapterNumber: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  steps: Array<{
    workflowRunId: string;
    stepName: string;
    status: string;
    errorMessage: string | null;
    startedAt: Date | string;
    updatedAt: Date | string;
  }>;
}): WorkflowRunDetail {
  return {
    ...toWorkflowRunSummary(record),
    steps: record.steps.map((step) => ({
      workflowRunId: step.workflowRunId,
      stepName: step.stepName,
      status: step.status,
      errorMessage: step.errorMessage,
      startedAt: toIsoString(step.startedAt) ?? '',
      updatedAt: toIsoString(step.updatedAt) ?? ''
    }))
  };
}

async function getWorkflowRunRepository() {
  const { WorkflowRunRepository } = await import(
    '../../../../packages/storage/src/repositories/workflow-run-repository'
  );

  return new WorkflowRunRepository();
}

export function registerWorkflowRunRoutes(app: FastifyInstance) {
  app.get('/workflow-runs', async () => {
    try {
      const repository = await getWorkflowRunRepository();
      const runs = await repository.listRuns();

      return {
        items: runs.map(toWorkflowRunSummary)
      };
    } catch {
      return {
        items: []
      };
    }
  });

  app.get('/workflow-runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const repository = await getWorkflowRunRepository();
    const run = await repository.getRunDetail(runId);

    if (!run) {
      return reply.code(404).send({
        message: 'Workflow run not found'
      });
    }

    return toWorkflowRunDetail(run as never);
  });
}
