import { describe, expect, it } from 'vitest';
import { buildDecisionPacket } from '../../packages/agent-runtime/src/decision-packet';

describe('buildDecisionPacket', () => {
  it('assembles a focused packet from review and story context', () => {
    const packet = buildDecisionPacket({
      projectId: 'project-1',
      chapterNumber: 12,
      currentVolumeGoal: 'break the alliance',
      recentSummaries: ['chapter 10 summary', 'chapter 11 summary'],
      reviewIssues: ['relationship fracture happens too early'],
      currentProposal: 'confirm the breakup in chapter 12'
    });

    expect(packet).toEqual({
      projectId: 'project-1',
      chapterNumber: 12,
      currentVolumeGoal: 'break the alliance',
      recentSummaries: ['chapter 10 summary', 'chapter 11 summary'],
      reviewIssues: ['relationship fracture happens too early'],
      currentProposal: 'confirm the breakup in chapter 12',
      riskAnalysis: 'relationship fracture happens too early',
      candidateAlternatives: []
    });
  });

  it('keeps review issues available for downstream decision handling', () => {
    const packet = buildDecisionPacket({
      projectId: 'project-2',
      chapterNumber: 7,
      currentVolumeGoal: 'resolve the theft',
      recentSummaries: ['chapter 5 summary'],
      reviewIssues: ['needs an alternate path'],
      currentProposal: 'end with the confession'
    });

    expect(packet.reviewIssues).toEqual(['needs an alternate path']);
    expect(packet.candidateAlternatives).toEqual([]);
  });
});
