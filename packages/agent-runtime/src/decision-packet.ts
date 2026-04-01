import { assembleDecisionPacketContext } from './context-assembler';

export interface DecisionPacket {
  projectId: string;
  chapterNumber: number;
  currentVolumeGoal: string;
  recentSummaries: string[];
  reviewIssues: string[];
  currentProposal: string;
  riskAnalysis: string;
  candidateAlternatives: string[];
}

export function buildDecisionPacket(input: {
  projectId: string;
  chapterNumber: number;
  currentVolumeGoal: string;
  recentSummaries: string[];
  reviewIssues: string[];
  currentProposal: string;
}): DecisionPacket {
  const context = assembleDecisionPacketContext(input);

  return {
    projectId: context.projectId,
    chapterNumber: context.chapterNumber,
    currentVolumeGoal: context.currentVolumeGoal,
    recentSummaries: context.recentSummaries,
    reviewIssues: context.reviewIssues,
    currentProposal: context.currentProposal,
    riskAnalysis: context.reviewIssues.join('; '),
    candidateAlternatives: []
  };
}
