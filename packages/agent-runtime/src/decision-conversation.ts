export interface DecisionConversationInput {
  packet: Record<string, unknown>;
  messages: Array<{
    role: string;
    content: string;
    messageType?: string;
    sequence?: number;
  }>;
  currentDraftResolution: Record<string, unknown> | null;
}

function formatList(items: string[]) {
  if (items.length === 0) {
    return ['- none'];
  }

  return items.map((item) => `- ${item}`);
}

function formatMessage(
  message: DecisionConversationInput['messages'][number],
  index: number
) {
  const prefix = `${message.sequence ?? index + 1}. ${message.role.toUpperCase()}`;
  const typeSuffix = message.messageType ? ` (${message.messageType})` : '';
  return `${prefix}${typeSuffix}: ${message.content}`;
}

export function assembleDecisionConversation(
  input: DecisionConversationInput
): string {
  const { packet, messages, currentDraftResolution } = input;

  const reviewIssues = Array.isArray(packet.reviewIssues)
    ? packet.reviewIssues.filter((item): item is string => typeof item === 'string')
    : [];
  const recentSummaries = Array.isArray(packet.recentSummaries)
    ? packet.recentSummaries.filter((item): item is string => typeof item === 'string')
    : [];
  const candidateAlternatives = Array.isArray(packet.candidateAlternatives)
    ? packet.candidateAlternatives.filter((item): item is string => typeof item === 'string')
    : [];

  return [
    '## Decision Packet',
    JSON.stringify(packet, null, 2),
    '',
    'Recent Summaries:',
    ...formatList(recentSummaries),
    '',
    'Review Issues:',
    ...formatList(reviewIssues),
    '',
    `Current Proposal: ${String(packet.currentProposal ?? 'n/a')}`,
    `Risk Analysis: ${String(packet.riskAnalysis ?? 'n/a')}`,
    '',
    'Candidate Alternatives:',
    ...formatList(candidateAlternatives),
    '',
    '## Conversation History',
    ...(messages.length > 0
      ? messages.map(formatMessage)
      : ['- none yet'])
    ,
    '',
    '## Draft Resolution',
    JSON.stringify(currentDraftResolution, null, 2)
  ].join('\n');
}
