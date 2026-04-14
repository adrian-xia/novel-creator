import { prisma } from '../client';

type CreateRunInput = {
  flowName: string;
  projectId: string;
  chapterNumber: number | null;
};

export class WorkflowRunRepository {
  async listRuns() {
    return prisma.workflowRunRecord.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
  }

  async findLatestActiveRun(projectId: string) {
    return prisma.workflowRunRecord.findFirst({
      where: {
        projectId,
        status: {
          in: ['queued', 'running']
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async createRun(input: CreateRunInput) {
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
      data: { status: 'succeeded', errorMessage: null }
    });
  }

  async markStepFailed(workflowRunId: string, stepName: string, errorMessage: string) {
    return prisma.stepRunRecord.updateMany({
      where: { workflowRunId, stepName },
      data: { status: 'failed', errorMessage }
    });
  }

  async markRunSucceeded(workflowRunId: string) {
    return prisma.workflowRunRecord.update({
      where: { id: workflowRunId },
      data: { status: 'succeeded', errorMessage: null }
    });
  }

  async markRunFailed(workflowRunId: string, errorMessage: string) {
    return prisma.workflowRunRecord.update({
      where: { id: workflowRunId },
      data: { status: 'failed', errorMessage }
    });
  }

  async markRunWaitingForHumanGate(workflowRunId: string, sessionId: string) {
    return prisma.workflowRunRecord.update({
      where: { id: workflowRunId },
      data: {
        status: 'waiting_for_human_gate',
        errorMessage: `Waiting for human gate session ${sessionId}`
      }
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
