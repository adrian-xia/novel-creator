import { assembleDecisionPacketContext } from './context-assembler';

export function buildDecisionPacket(input: {
  projectId: string;
  chapterNumber: number;
  currentVolumeGoal: string;
  recentSummaries: string[];
  reviewIssues: string[];
  currentProposal: string;
}) {
  const context = assembleDecisionPacketContext(input);

  return {
    projectId: context.projectId,
    chapterNumber: context.chapterNumber,
    currentVolumeGoal: context.currentVolumeGoal,
    recentSummaries: context.recentSummaries,
    currentProposal: context.currentProposal,
    riskAnalysis: context.reviewIssues.join('; ')
  };
}
