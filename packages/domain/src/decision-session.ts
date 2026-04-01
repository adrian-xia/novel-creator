export type DecisionSessionStatus =
  | 'open'
  | 'awaiting_model_reply'
  | 'awaiting_human_resolution'
  | 'resolved'
  | 'cancelled';

export type DecisionMessageRole = 'human' | 'assistant' | 'system';

export interface DecisionSession {
  id: string;
  projectId: string;
  chapterNumber: number;
  status: DecisionSessionStatus;
  packet: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionMessage {
  sessionId: string;
  role: DecisionMessageRole;
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
  nextAction: 'resume_review' | 'replan_chapter' | 'pause_project';
}
