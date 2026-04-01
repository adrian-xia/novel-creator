import { describe, expectTypeOf, it } from 'vitest';
import type {
  AgentRun,
  ChapterDraft,
  ChapterPlan,
  ChapterState,
  ReviewIssue,
  ReviewOutcome,
  StoryState
} from '../../packages/domain/src';
import type { JsonObject, JsonValue } from '../../packages/domain/src/prompt-config';

describe('story-state domain contracts', () => {
  it('exposes the story production types', () => {
    expectTypeOf<StoryState>().toEqualTypeOf<{
      projectId: string;
      storyBible: string | null;
      outline: JsonValue | null;
      volumePlans: JsonValue[];
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

    expectTypeOf<ChapterPlan>().toEqualTypeOf<{
      projectId: string;
      chapterNumber: number;
      title: string;
      goal: string;
      beats: string[];
      povCharacter: string;
      hardConstraints: string[];
    }>();

    expectTypeOf<ChapterDraft>().toEqualTypeOf<{
      projectId: string;
      chapterNumber: number;
      version: number;
      content: string;
      summary: string | null;
      metadata: JsonObject;
    }>();

    expectTypeOf<ReviewIssue>().toEqualTypeOf<{
      code: string;
      message: string;
      severity: 'low' | 'medium' | 'high';
    }>();

    expectTypeOf<ReviewOutcome>().toEqualTypeOf<{
      projectId: string;
      chapterNumber: number;
      decision: 'approve' | 'rewrite' | 'blocked_for_manual_decision';
      issues: ReviewIssue[];
      rewriteInstructions: string[];
      canAutoRewrite: boolean;
      triggeredManualDecision: boolean;
    }>();

    expectTypeOf<AgentRun>().toEqualTypeOf<{
      projectId: string;
      chapterNumber: number | null;
      agentType: string;
      promptConfigVersion: number;
      provider: string;
      model: string;
      apiKeyId: string;
      leaseId: string;
      inputSnapshot: JsonObject;
      rawOutput: string;
      parsedOutput: JsonValue | null;
      status: 'succeeded' | 'failed';
      tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
      errorMessage: string | null;
    }>();
  });
});
