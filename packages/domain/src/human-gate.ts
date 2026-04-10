export type HumanGateType =
  | 'outline_confirmation'
  | 'volume_confirmation'
  | 'blocked_decision'
  | 'resume_confirmation';

export type HumanGateOptionStrategy = 'recommended' | 'alternative' | 'custom_seed';

export type HumanGateSessionStatus =
  | 'open'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'cancelled';

export interface HumanGateOption {
  optionId: string;
  title: string;
  strategy: HumanGateOptionStrategy;
  rationale: string;
  impactSummary: string;
  patch: Record<string, unknown>;
}

export interface HumanGateSession {
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
}
