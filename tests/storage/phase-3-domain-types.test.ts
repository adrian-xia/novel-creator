import { describe, expectTypeOf, it } from 'vitest';
import type {
  DecisionMessage,
  DecisionResolution,
  DecisionSession,
  ExportArtifact,
  PublishProfile,
  PublishTask,
  StepRun,
  WorkflowRun
} from '../../packages/domain/src';

describe('phase 3 domain contracts', () => {
  it('exports decision-session, publishing, and workflow observability types', () => {
    expectTypeOf<DecisionSession>().toMatchTypeOf<{
      id: string;
      projectId: string;
      chapterNumber: number;
      status:
        | 'open'
        | 'awaiting_model_reply'
        | 'awaiting_human_resolution'
        | 'resolved'
        | 'cancelled';
      packet: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
    }>();

    expectTypeOf<DecisionMessage>().toMatchTypeOf<{
      sessionId: string;
      role: 'human' | 'assistant' | 'system';
      content: string;
    }>();

    expectTypeOf<DecisionResolution>().toMatchTypeOf<{
      sessionId: string;
      resolutionType:
        | 'accept_current'
        | 'accept_alternative'
        | 'replan_required'
        | 'pause_project';
      decisionSummary: string;
      storyFactsToApply: string[];
      chapterPlanAdjustments: string[];
      volumeImpact: string | null;
      nextAction: 'resume_review' | 'replan_chapter' | 'pause_project';
    }>();

    expectTypeOf<PublishProfile>().toMatchTypeOf<{
      projectId: string;
      publishEnabled: boolean;
      autoPublishTargets: string[];
      manualExportTargets: string[];
      defaultExportFormat: 'plain_text' | 'markdown' | 'bundle';
      effectiveFromChapter: number | null;
    }>();

    expectTypeOf<PublishTask>().toMatchTypeOf<{
      id: string;
      projectId: string;
      chapterNumber: number;
      targetPlatform: string;
      mode: 'adapter_publish' | 'manual_export';
      status:
        | 'pending'
        | 'publishing'
        | 'published'
        | 'exporting'
        | 'exported'
        | 'manual_upload_pending'
        | 'manual_upload_confirmed'
        | 'failed';
      artifactId: string | null;
    }>();

    expectTypeOf<ExportArtifact>().toMatchTypeOf<{
      id: string;
      projectId: string;
      chapterNumber: number;
      targetPlatform: string;
      format: 'plain_text' | 'markdown' | 'bundle';
      content: string;
    }>();

    expectTypeOf<WorkflowRun>().toMatchTypeOf<{
      id: string;
      flowName: string;
      projectId: string;
      chapterNumber: number | null;
      status: 'queued' | 'running' | 'succeeded' | 'failed';
    }>();

    expectTypeOf<StepRun>().toMatchTypeOf<{
      workflowRunId: string;
      stepName: string;
      status: 'pending' | 'running' | 'succeeded' | 'failed';
      errorMessage: string | null;
    }>();
  });
});
