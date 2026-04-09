export interface WorkflowDefinition {
  name: string;
  steps: string[];
}

export interface WorkflowTriggerPayload {
  projectId: string;
  chapterNumber: number | null;
}

export function createProjectFlow(): WorkflowDefinition {
  return {
    name: 'create-project-flow',
    steps: ['persist-project', 'enqueue-outline', 'mark-project-active']
  };
}
