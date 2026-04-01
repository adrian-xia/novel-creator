export interface WorkflowRun {
  id: string;
  flowName: string;
  projectId: string;
  chapterNumber: number | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  errorMessage?: string | null;
}

export interface StepRun {
  workflowRunId: string;
  stepName: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  errorMessage: string | null;
}
