import type { FastifyInstance } from 'fastify';
import {
  continueProject,
  enqueueWorkflow,
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow
} from '../../../../packages/workflows/src';

async function getWorkflowRunRepository() {
  const { WorkflowRunRepository } = await import(
    '../../../../packages/storage/src/repositories/workflow-run-repository'
  );

  return new WorkflowRunRepository();
}

export function registerStoryProductionRoutes(app: FastifyInstance) {
  app.post('/projects/:projectId/flows/outline', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const repository = await getWorkflowRunRepository();
    const flow = generateOutlineFlow();
    const workflowRun = await repository.createRun({
      flowName: flow.name,
      projectId,
      chapterNumber: null
    });

    return reply.code(202).send({
      projectId,
      workflowRunId: workflowRun.id,
      ...enqueueWorkflow(flow)
    });
  });

  app.post('/projects/:projectId/flows/volume', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const repository = await getWorkflowRunRepository();
    const flow = generateVolumeFlow();
    const workflowRun = await repository.createRun({
      flowName: flow.name,
      projectId,
      chapterNumber: null
    });

    return reply.code(202).send({
      projectId,
      workflowRunId: workflowRun.id,
      ...enqueueWorkflow(flow)
    });
  });

  app.post('/projects/:projectId/flows/next-chapter', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const repository = await getWorkflowRunRepository();
    const flow = generateChapterFlow();
    const workflowRun = await repository.createRun({
      flowName: flow.name,
      projectId,
      chapterNumber: null
    });

    return reply.code(202).send({
      projectId,
      workflowRunId: workflowRun.id,
      ...enqueueWorkflow(flow)
    });
  });

  app.post('/projects/:projectId/continue', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const result = await continueProject(projectId);

    return reply.code(200).send(result);
  });
}
