import { prisma } from '../client';

export class WorkflowRunRepository {
  async createRun(input: { flowName: string; projectId: string; chapterNumber: number | null }) {
    return prisma.workflowRunRecord.create({
      data: {
        flowName: input.flowName,
        projectId: input.projectId,
        chapterNumber: input.chapterNumber,
        status: 'queued'
      }
    });
  }

  async markStepRunning(workflowRunId: string, stepName: string) {
    return prisma.stepRunRecord.create({
      data: {
        workflowRunId,
        stepName,
        status: 'running'
      }
    });
  }

  async markStepSucceeded(workflowRunId: string, stepName: string) {
    return prisma.stepRunRecord.updateMany({
      where: { workflowRunId, stepName },
      data: { status: 'succeeded' }
    });
  }

  async markRunSucceeded(workflowRunId: string) {
    return prisma.workflowRunRecord.update({
      where: { id: workflowRunId },
      data: { status: 'succeeded' }
    });
  }

  async getRunDetail(workflowRunId: string) {
    const run = await prisma.workflowRunRecord.findUnique({
      where: { id: workflowRunId },
      include: {
        stepRuns: { orderBy: { startedAt: 'asc' } }
      }
    });

    if (!run) {
      return null;
    }

    const { stepRuns, ...rest } = run;

    return {
      ...rest,
      steps: stepRuns
    };
  }
}
