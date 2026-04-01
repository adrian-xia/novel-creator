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

    expect(packet.chapterNumber).toBe(12);
    expect(packet.recentSummaries).toHaveLength(2);
    expect(packet.riskAnalysis).toContain('too early');
  });
});
