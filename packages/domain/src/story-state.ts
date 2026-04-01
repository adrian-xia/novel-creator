import type { JsonObject, JsonValue } from './prompt-config';

export type ChapterState =
  | 'pending'
  | 'planned'
  | 'drafted'
  | 'in_review'
  | 'needs_rewrite'
  | 'approved'
  | 'blocked_for_manual_decision'
  | 'failed';

export interface StoryState {
  projectId: string;
  storyBible: string | null;
  outline: JsonValue | null;
  volumePlans: JsonValue[];
  confirmedFacts: string[];
  openForeshadowing: string[];
  chapterSummaries: Array<{ chapterNumber: number; summary: string }>;
  currentPosition: {
    nextChapterNumber: number;
    currentVolumeNumber: number | null;
  };
}

export interface ChapterPlan {
  projectId: string;
  chapterNumber: number;
  title: string;
  goal: string;
  beats: string[];
  povCharacter: string;
  hardConstraints: string[];
}

export interface ChapterDraft {
  projectId: string;
  chapterNumber: number;
  version: number;
  content: string;
  summary: string | null;
  metadata: JsonObject;
}

export interface ReviewIssue {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ReviewOutcome {
  projectId: string;
  chapterNumber: number;
  decision: 'approve' | 'rewrite' | 'blocked_for_manual_decision';
  issues: ReviewIssue[];
  rewriteInstructions: string[];
  canAutoRewrite: boolean;
  triggeredManualDecision: boolean;
}

export interface AgentRun {
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
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  errorMessage: string | null;
}
