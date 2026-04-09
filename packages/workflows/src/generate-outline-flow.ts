import type { WorkflowTriggerPayload } from './create-project-flow';
import {
  loadOutlineProjectStep,
  loadOutlinePromptStep,
  persistOutlineStep,
  runOutlineAgentStep,
  validateOutlineOutputStep
} from './outline-volume-executors';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface OutlineFlowContext {
  projectId: string;
  chapterNumber: number | null;
  project?: {
    id: string;
    premise: string;
    genre: string;
    storyState?: {
      storyBible: string | null;
    } | null;
  };
  prompt?: {
    id: string;
    agentName: string;
    version: number;
    systemPrompt: string;
    taskTemplate: string;
    outputSchema: Record<string, unknown>;
    enabled: boolean;
  };
  rawOutlineOutput?: Record<string, unknown> | null;
  outline?: Record<string, unknown>;
  storyBible?: string | null;
}

export function generateOutlineFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  OutlineFlowContext
> {
  return {
    name: 'generate-outline-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'load-project-input', run: async (context, deps) => loadOutlineProjectStep(context, deps) },
      { name: 'load-outline-prompt', run: async (context, deps) => loadOutlinePromptStep(context, deps) },
      { name: 'run-outline-agent', run: async (context, deps) => runOutlineAgentStep(context, deps) },
      { name: 'validate-outline-output', run: async (context) => validateOutlineOutputStep(context) },
      { name: 'persist-outline', run: async (context, deps) => persistOutlineStep(context, deps) }
    ]
  };
}
