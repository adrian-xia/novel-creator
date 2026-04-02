export type DecisionSessionStatus =
  | 'open'
  | 'awaiting_assistant_reply'
  | 'awaiting_human_input'
  | 'awaiting_resolution_confirmation'
  | 'resolved'
  | 'cancelled';

export type DecisionMessageRole = 'human' | 'assistant' | 'system';

export interface DecisionSession {
  id: string;
  projectId: string;
  chapterNumber: number;
  triggerReason: string | null;
  sourceReviewOutcomeId: string | null;
  status: DecisionSessionStatus;
  packet: Record<string, unknown>;
  contextSnapshot: Record<string, unknown>;
  currentDraftResolution: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

export interface DecisionMessage {
  sessionId: string;
  sequence: number;
  role: DecisionMessageRole;
  messageType: 'human' | 'assistant' | 'system' | 'resolution_draft';
  content: string;
  createdAt?: string;
}

export interface DecisionResolution {
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
  replanRange: { startChapter: number; endChapter: number } | null;
  resumeFromChapter: number | null;
  invalidateExistingPlans: boolean;
}
