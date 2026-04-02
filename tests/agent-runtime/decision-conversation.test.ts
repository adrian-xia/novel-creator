import { describe, expect, it } from 'vitest';
import { assembleDecisionConversation } from '../../packages/agent-runtime/src/decision-conversation';
import { assembleDecisionConversationContext } from '../../packages/agent-runtime/src/context-assembler';

describe('assembleDecisionConversation', () => {
  it('includes message history, review issues, and current draft when assembling assistant input', () => {
    const conversation = assembleDecisionConversation({
      packet: {
        chapterNumber: 8,
        reviewIssues: ['twist too early'],
        currentProposal: 'reveal the traitor in chapter 8',
        riskAnalysis: 'the twist lands before tension builds'
      },
      messages: [
        { role: 'human', content: '给我两个替代方案' },
        { role: 'assistant', content: '方案 A / 方案 B' }
      ],
      currentDraftResolution: { resolutionType: 'accept_alternative' }
    });

    expect(conversation).toContain('twist too early');
    expect(conversation).toContain('给我两个替代方案');
    expect(conversation).toContain('accept_alternative');
  });

  it('assembles the same conversation through the shared context helper', () => {
    const conversation = assembleDecisionConversationContext({
      packet: {
        chapterNumber: 6,
        recentSummaries: ['chapter 5 summary'],
        reviewIssues: ['needs a credible escape route'],
        currentProposal: 'corner the thief at the market',
        riskAnalysis: 'the thief needs a believable exit'
      },
      messageHistory: []
      ,
      currentDraftResolution: null
    });

    expect(conversation).toContain('## Decision Packet');
    expect(conversation).toContain('## Draft Resolution');
    expect(conversation).toContain('null');
    expect(conversation).toContain('## Conversation History');
    expect(conversation).toContain('- none yet');
  });
});
