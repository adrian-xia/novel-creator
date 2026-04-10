import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  workflowRunRecord: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  stepRunRecord: {
    create: vi.fn(),
    updateMany: vi.fn()
  }
}));

vi.mock('../../packages/storage/src/client', () => ({ prisma }));

describe('WorkflowRunRepository', () => {
  beforeEach(() => {
    Object.values(prisma).forEach((model) => {
      Object.values(model).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          fn.mockReset();
        }
      });
    });
  });

  it('persists workflow and step status transitions', async () => {
    prisma.workflowRunRecord.create.mockResolvedValue({
      id: 'workflow-run-1',
      flowName: 'publish-chapter-flow',
      projectId: 'project-1',
      chapterNumber: 10,
      status: 'queued'
    });
    prisma.stepRunRecord.create.mockResolvedValue({
      workflowRunId: 'workflow-run-1',
      stepName: 'expand-publish-tasks',
      status: 'running'
    });
    prisma.stepRunRecord.updateMany.mockResolvedValue({ count: 1 });
    prisma.workflowRunRecord.update.mockResolvedValue({
      id: 'workflow-run-1',
      status: 'succeeded'
    });
    prisma.workflowRunRecord.findUnique.mockResolvedValue({
      id: 'workflow-run-1',
      status: 'succeeded',
      stepRuns: [{ stepName: 'expand-publish-tasks', status: 'succeeded' }]
    });

    const { WorkflowRunRepository } = await import(
      '../../packages/storage/src/repositories/workflow-run-repository'
    );
    const repository = new WorkflowRunRepository();

    const run = await repository.createRun({
      flowName: 'publish-chapter-flow',
      projectId: 'project-1',
      chapterNumber: 10
    });

    expect(prisma.workflowRunRecord.create).toHaveBeenCalledWith({
      data: {
        flowName: 'publish-chapter-flow',
        projectId: 'project-1',
        chapterNumber: 10,
        status: 'queued'
      }
    });

    await repository.markStepRunning(run.id, 'expand-publish-tasks');
    await repository.markStepSucceeded(run.id, 'expand-publish-tasks');
    await repository.markRunSucceeded(run.id);

    expect(prisma.stepRunRecord.updateMany).toHaveBeenCalledWith({
      where: { workflowRunId: run.id, stepName: 'expand-publish-tasks' },
      data: { status: 'succeeded', errorMessage: null }
    });
    expect(prisma.workflowRunRecord.update).toHaveBeenCalledWith({
      where: { id: run.id },
      data: { status: 'succeeded', errorMessage: null }
    });

    const detail = await repository.getRunDetail(run.id);
    expect(detail?.status).toBe('succeeded');
    expect(detail?.steps[0]?.status).toBe('succeeded');
  });

  it('stores a failed step message and failed run message', async () => {
    prisma.stepRunRecord.updateMany.mockResolvedValue({ count: 1 });
    prisma.workflowRunRecord.update.mockResolvedValue({
      id: 'workflow-run-2',
      status: 'failed'
    });

    const { WorkflowRunRepository } = await import(
      '../../packages/storage/src/repositories/workflow-run-repository'
    );
    const repository = new WorkflowRunRepository();

    await repository.markStepFailed('workflow-run-2', 'run-outline-agent', 'bad schema');
    await repository.markRunFailed('workflow-run-2', 'bad schema');

    expect(prisma.stepRunRecord.updateMany).toHaveBeenCalledWith({
      where: { workflowRunId: 'workflow-run-2', stepName: 'run-outline-agent' },
      data: { status: 'failed', errorMessage: 'bad schema' }
    });
    expect(prisma.workflowRunRecord.update).toHaveBeenCalledWith({
      where: { id: 'workflow-run-2' },
      data: { status: 'failed', errorMessage: 'bad schema' }
    });
  });

  it('marks a workflow run as waiting_for_human_gate with the gate session id', async () => {
    prisma.workflowRunRecord.update.mockResolvedValue({
      id: 'workflow-run-3',
      status: 'waiting_for_human_gate',
      errorMessage: 'Waiting for human gate session session-123'
    });

    const { WorkflowRunRepository } = await import(
      '../../packages/storage/src/repositories/workflow-run-repository'
    );
    const repository = new WorkflowRunRepository();

    await repository.markRunWaitingForHumanGate('workflow-run-1', 'session-123');

    expect(prisma.workflowRunRecord.update).toHaveBeenCalledWith({
      where: { id: 'workflow-run-1' },
      data: {
        status: 'waiting_for_human_gate',
        errorMessage: 'Waiting for human gate session session-123'
      }
    });
  });
});
