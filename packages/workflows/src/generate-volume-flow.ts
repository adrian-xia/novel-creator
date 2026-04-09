import type { WorkflowTriggerPayload } from './create-project-flow';
import {
  loadVolumeOutlineStep,
  loadVolumePromptStep,
  persistVolumePlansStep,
  runVolumeAgentStep,
  validateVolumeOutputStep
} from './outline-volume-executors';
import type { ExecutableWorkflow } from './workflow-runtime';

export interface VolumeFlowContext {
  projectId: string;
  chapterNumber: number | null;
  project?: {
    id: string;
    premise: string;
    genre: string;
    storyState?: {
      outline: Record<string, unknown> | null;
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
  rawVolumeOutput?: Record<string, unknown> | null;
  outline?: Record<string, unknown>;
  storyBible?: string | null;
  volumePlans?: Array<Record<string, unknown>>;
}

export function generateVolumeFlow(): ExecutableWorkflow<
  WorkflowTriggerPayload,
  VolumeFlowContext
> {
  return {
    name: 'generate-volume-flow',
    buildInitialContext: (payload) => payload,
    steps: [
      { name: 'load-outline', run: async (context, deps) => loadVolumeOutlineStep(context, deps) },
      { name: 'load-volume-prompt', run: async (context, deps) => loadVolumePromptStep(context, deps) },
      { name: 'run-volume-agent', run: async (context, deps) => runVolumeAgentStep(context, deps) },
      { name: 'validate-volume-output', run: async (context) => validateVolumeOutputStep(context) },
      { name: 'persist-volume-plans', run: async (context, deps) => persistVolumePlansStep(context, deps) }
    ]
  };
}
