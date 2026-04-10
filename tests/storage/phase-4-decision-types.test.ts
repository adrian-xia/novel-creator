import { describe, expectTypeOf, it } from 'vitest';
import type {
  ChapterRecoveryTask,
  ChapterState,
  DecisionMessage,
  DecisionResolution,
  DecisionSession,
  HumanGateOption,
  HumanGateSession,
  HumanGateType,
  HumanGateOptionStrategy,
  HumanGateSessionStatus,
  ReplanRange
} from '../../packages/domain/src';

describe('phase 4 decision contracts', () => {
  it('exposes multi-turn decision and recovery types', () => {
    expectTypeOf<DecisionSession>().toEqualTypeOf<{
      id: string;
      projectId: string;
      chapterNumber: number;
      triggerReason: string | null;
      sourceReviewOutcomeId: string | null;
      status:
        | 'open'
        | 'awaiting_assistant_reply'
        | 'awaiting_human_input'
        | 'awaiting_resolution_confirmation'
        | 'resolved'
        | 'cancelled';
      packet: Record<string, unknown>;
      contextSnapshot: Record<string, unknown>;
      currentDraftResolution: Record<string, unknown> | null;
      createdAt: string;
      updatedAt: string;
      resolvedAt?: string | null;
    }>();

    expectTypeOf<DecisionMessage>().toEqualTypeOf<{
      sessionId: string;
      sequence: number;
      role: 'human' | 'assistant' | 'system';
      messageType: 'human' | 'assistant' | 'system' | 'resolution_draft';
      content: string;
      createdAt?: string;
    }>();

    expectTypeOf<ReplanRange>().toEqualTypeOf<{
      startChapter: number;
      endChapter: number;
    }>();

    expectTypeOf<DecisionResolution>().toEqualTypeOf<{
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
      nextAction: 'resume_current_chapter' | 'replan_window' | 'pause_project';
      replanRange: ReplanRange | null;
      resumeFromChapter: number | null;
      invalidateExistingPlans: boolean;
    }>();

    expectTypeOf<ChapterRecoveryTask>().toEqualTypeOf<{
      id: string;
      projectId: string;
      sessionId: string;
      startChapter: number;
      endChapter: number;
      resumeFromChapter: number;
      status: 'pending' | 'running' | 'completed' | 'failed';
    }>();

    expectTypeOf<ChapterState>().toEqualTypeOf<
      | 'pending'
      | 'planned'
      | 'drafted'
      | 'in_review'
      | 'needs_rewrite'
      | 'approved'
      | 'blocked_for_manual_decision'
      | 'needs_replan'
      | 'paused_by_decision'
      | 'failed'
    >();
  });

  it('exposes reusable human gate types for confirmation workflows', () => {
    expectTypeOf<HumanGateType>().toEqualTypeOf<
      | 'outline_confirmation'
      | 'volume_confirmation'
      | 'blocked_decision'
      | 'resume_confirmation'
    >();

    expectTypeOf<HumanGateOptionStrategy>().toEqualTypeOf<
      | 'recommended'
      | 'alternative'
      | 'custom_seed'
    >();

    expectTypeOf<HumanGateOption>().toEqualTypeOf<{
      optionId: string;
      title: string;
      strategy: HumanGateOptionStrategy;
      rationale: string;
      impactSummary: string;
      patch: Record<string, unknown>;
    }>();

    expectTypeOf<HumanGateSessionStatus>().toEqualTypeOf<
      | 'open'
      | 'awaiting_confirmation'
      | 'confirmed'
      | 'cancelled'
    >();

    expectTypeOf<HumanGateSession>().toEqualTypeOf<{
      id: string;
      projectId: string;
      chapterNumber: number | null;
      gateType: HumanGateType;
      status: HumanGateSessionStatus;
      contextSnapshot: Record<string, unknown>;
      options: HumanGateOption[];
      recommendedOptionId: string | null;
      selectedOptionId: string | null;
      humanNotes: string | null;
    }>();
  });
});
