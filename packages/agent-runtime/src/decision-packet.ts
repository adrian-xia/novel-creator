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
  contextSnapshot: {
    storyContext: {
      projectId: string;
      chapterNumber: number;
      currentVolumeGoal: string;
      recentSummaries: string[];
    };
    reviewContext: {
      reviewIssues: string[];
      currentProposal: string;
      riskAnalysis: string;
      candidateAlternatives: string[];
    };
  };
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
    projectId: context.storyContext.projectId,
    chapterNumber: context.storyContext.chapterNumber,
    currentVolumeGoal: context.storyContext.currentVolumeGoal,
    recentSummaries: context.storyContext.recentSummaries,
    reviewIssues: context.reviewContext.reviewIssues,
    currentProposal: context.reviewContext.currentProposal,
    riskAnalysis: context.reviewContext.riskAnalysis,
    candidateAlternatives: context.reviewContext.candidateAlternatives,
    contextSnapshot: context
  };
}
