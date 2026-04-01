import { describe, expectTypeOf, it } from 'vitest';
import type {
  AgentRun,
  ChapterDraft,
  ChapterPlan,
  ChapterState,
  ReviewOutcome,
  StoryState
} from '../../packages/domain/src';

describe('story-state domain contracts', () => {
  it('exposes the story production types', () => {
    expectTypeOf<StoryState>().toMatchTypeOf<{
      projectId: string;
      storyBible: string | null;
      outline: unknown | null;
      volumePlans: unknown[];
      confirmedFacts: string[];
      openForeshadowing: string[];
      chapterSummaries: Array<{ chapterNumber: number; summary: string }>;
      currentPosition: { nextChapterNumber: number; currentVolumeNumber: number | null };
    }>();

    expectTypeOf<ChapterState>().toEqualTypeOf<
      | 'pending'
      | 'planned'
      | 'drafted'
      | 'in_review'
      | 'needs_rewrite'
      | 'approved'
      | 'blocked_for_manual_decision'
      | 'failed'
    >();

    expectTypeOf<ChapterPlan>().toMatchTypeOf<{
      projectId: string;
      chapterNumber: number;
      title: string;
      goal: string;
      beats: string[];
      povCharacter: string;
      hardConstraints: string[];
    }>();

    expectTypeOf<ChapterDraft>().toMatchTypeOf<{
      projectId: string;
      chapterNumber: number;
      version: number;
      content: string;
      summary: string | null;
      metadata: Record<string, unknown>;
    }>();

    expectTypeOf<ReviewOutcome>().toMatchTypeOf<{
      projectId: string;
      chapterNumber: number;
      decision: 'approve' | 'rewrite' | 'blocked_for_manual_decision';
      issues: Array<{ code: string; message: string; severity: 'low' | 'medium' | 'high' }>;
      rewriteInstructions: string[];
      canAutoRewrite: boolean;
      triggeredManualDecision: boolean;
    }>();

    expectTypeOf<AgentRun>().toMatchTypeOf<{
      projectId: string;
      chapterNumber: number | null;
      agentType: string;
      promptConfigVersion: number;
      provider: string;
      model: string;
      apiKeyId: string;
      leaseId: string;
      inputSnapshot: Record<string, unknown>;
      rawOutput: string;
      parsedOutput: Record<string, unknown> | null;
      status: 'succeeded' | 'failed';
      tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
      errorMessage: string | null;
    }>();
  });
});
