import type { ReviewIssue, ReviewOutcome } from '@novel-creator/domain';
import type { PromptRepository } from '../../storage/src/repositories/prompt-repository';
import type { DecisionSessionRepository } from '../../storage/src/repositories/decision-session-repository';
import type { StoryStateRepository } from '../../storage/src/repositories/story-state-repository';
import { decideReviewNextState } from './review-policy';
import type { ReviewRewriteFlowContext } from './review-rewrite-flow';
import type { WorkflowAgentRunner } from './workflow-deps';

interface ReviewRewriteWorkflowDeps {
  promptRepository: Pick<PromptRepository, 'findLatestEnabledByAgentName'>;
  storyStateRepository: Pick<
    StoryStateRepository,
    | 'getLatestChapterDraft'
    | 'saveReviewOutcome'
    | 'saveWorkflowDecidedChapterState'
    | 'saveApprovedChapterSummary'
    | 'saveChapterDraft'
    | 'markChapterBlockedForDecision'
  >;
  decisionSessionRepository: Pick<DecisionSessionRepository, 'createBlockingDecisionTrigger'>;
  agentRunner?: WorkflowAgentRunner;
  defaultProvider?: string;
  defaultModel?: string;
}

type PromptInput = {
  agentName: string;
  version: number;
  systemPrompt: string;
  taskTemplate: string;
};

function requireRuntimeConfig(deps: ReviewRewriteWorkflowDeps) {
  if (!deps.agentRunner || !deps.defaultProvider || !deps.defaultModel) {
    throw new Error('Review rewrite workflow runtime dependencies are not configured');
  }

  return {
    agentRunner: deps.agentRunner,
    defaultProvider: deps.defaultProvider,
    defaultModel: deps.defaultModel
  };
}

function requirePrompt(prompt: PromptInput | null, agentName: string) {
  if (!prompt) {
    throw new Error(`Prompt config not found for ${agentName}`);
  }

  return prompt;
}

function requireChapterNumber(chapterNumber: number | null): number {
  if (typeof chapterNumber !== 'number') {
    throw new Error('Review rewrite flow requires a chapter number');
  }

  return chapterNumber;
}

function requireNonEmptyString(value: unknown, message: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }

  return value;
}

function normalizeStructuredAgentOutput(result: {
  rawOutput: string;
  parsedOutput: Record<string, unknown> | null;
}) {
  if (result.parsedOutput) {
    return result.parsedOutput;
  }

  if (result.rawOutput.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.rawOutput) as unknown;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function parseReviewIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      code: typeof item.code === 'string' ? item.code : 'review_issue',
      message: typeof item.message === 'string' ? item.message : 'unspecified review issue',
      severity:
        item.severity === 'low' || item.severity === 'medium' || item.severity === 'high'
          ? item.severity
          : 'medium'
    }));
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseReviewOutcomeOutput(output: Record<string, unknown> | null): {
  decision: ReviewOutcome['decision'];
  issues: ReviewIssue[];
  rewriteInstructions: string[];
  summary: string | null;
  triggeredManualDecision: boolean;
} {
  if (!output) {
    throw new Error('Invalid review output: missing payload');
  }

  const decision = output.decision;
  if (
    decision !== 'approve' &&
    decision !== 'rewrite' &&
    decision !== 'blocked_for_manual_decision'
  ) {
    throw new Error('Invalid review output: missing decision');
  }

  const summary =
    typeof output.summary === 'string' && output.summary.trim().length > 0
      ? output.summary
      : null;

  return {
    decision,
    issues: parseReviewIssues(output.issues),
    rewriteInstructions: parseStringList(output.rewriteInstructions),
    summary,
    triggeredManualDecision: decision === 'blocked_for_manual_decision'
  };
}

function parseRewriteOutput(
  result: { rawOutput: string; parsedOutput: Record<string, unknown> | null },
  chapterNumber: number
) {
  const output = normalizeStructuredAgentOutput(result);
  const metadataSource =
    output && output.metadata && typeof output.metadata === 'object' && !Array.isArray(output.metadata)
      ? (output.metadata as Record<string, unknown>)
      : {};

  return {
    content: requireNonEmptyString(
      result.rawOutput,
      `Invalid rewrite output for chapter ${chapterNumber}: empty content`
    ),
    metadata: metadataSource
  };
}

export async function executeReviewRewrite(
  context: ReviewRewriteFlowContext,
  deps: ReviewRewriteWorkflowDeps
): Promise<ReviewRewriteFlowContext & { reviewDecision: ReviewOutcome['decision'] }> {
  const chapterNumber = requireChapterNumber(context.chapterNumber);
  const runtime = requireRuntimeConfig(deps);
  let rewriteCount = 0;

  while (rewriteCount <= 2) {
    const latestDraft = await deps.storyStateRepository.getLatestChapterDraft(
      context.projectId,
      chapterNumber
    );

    if (!latestDraft) {
      throw new Error(`No draft found for chapter ${chapterNumber}`);
    }

    const reviewPrompt = requirePrompt(
      await deps.promptRepository.findLatestEnabledByAgentName('review-agent'),
      'review-agent'
    );
    const reviewResult = await runtime.agentRunner.run({
      agentType: 'review-agent',
      promptConfigVersion: reviewPrompt.version,
      projectId: context.projectId,
      chapterNumber,
      provider: runtime.defaultProvider,
      model: runtime.defaultModel,
      inputSnapshot: {
        systemPrompt: reviewPrompt.systemPrompt,
        taskTemplate: reviewPrompt.taskTemplate,
        variables: {
          content: latestDraft.content,
          version: latestDraft.version,
          metadata: latestDraft.metadata
        }
      }
    });
    const parsedReview = parseReviewOutcomeOutput(normalizeStructuredAgentOutput(reviewResult));

    await deps.storyStateRepository.saveReviewOutcome({
      projectId: context.projectId,
      chapterNumber,
      decision: parsedReview.decision,
      issues: parsedReview.issues,
      rewriteInstructions: parsedReview.rewriteInstructions,
      canAutoRewrite: parsedReview.decision === 'rewrite',
      triggeredManualDecision: parsedReview.triggeredManualDecision
    });

    const nextState = decideReviewNextState({
      decision: parsedReview.decision,
      rewriteCount,
      triggeredManualDecision: parsedReview.triggeredManualDecision
    });

    if (nextState.chapterState === 'approved') {
      await deps.storyStateRepository.saveWorkflowDecidedChapterState({
        projectId: context.projectId,
        chapterNumber,
        chapterState: 'approved'
      });
      await deps.storyStateRepository.saveApprovedChapterSummary({
        projectId: context.projectId,
        chapterNumber,
        summary: requireNonEmptyString(
          parsedReview.summary,
          `Invalid review output for chapter ${chapterNumber}: missing summary`
        ),
        nextChapterNumber: chapterNumber + 1
      });

      return {
        ...context,
        reviewDecision: 'approve'
      };
    }

    if (nextState.shouldRewrite) {
      const rewritePrompt = requirePrompt(
        await deps.promptRepository.findLatestEnabledByAgentName('rewrite-agent'),
        'rewrite-agent'
      );
      const rewriteResult = await runtime.agentRunner.run({
        agentType: 'rewrite-agent',
        promptConfigVersion: rewritePrompt.version,
        projectId: context.projectId,
        chapterNumber,
        provider: runtime.defaultProvider,
        model: runtime.defaultModel,
        inputSnapshot: {
          systemPrompt: rewritePrompt.systemPrompt,
          taskTemplate: rewritePrompt.taskTemplate,
          variables: {
            content: latestDraft.content,
            version: latestDraft.version,
            issues: parsedReview.issues,
            rewriteInstructions: parsedReview.rewriteInstructions,
            metadata: latestDraft.metadata
          }
        }
      });
      const rewrittenDraft = parseRewriteOutput(rewriteResult, chapterNumber);

      await deps.storyStateRepository.saveChapterDraft({
        projectId: context.projectId,
        chapterNumber,
        version: latestDraft.version + 1,
        content: rewrittenDraft.content,
        summary: latestDraft.summary,
        metadata: rewrittenDraft.metadata
      });

      rewriteCount += 1;
      continue;
    }

    await deps.storyStateRepository.markChapterBlockedForDecision({
      projectId: context.projectId,
      chapterNumber
    });
    await deps.decisionSessionRepository.createBlockingDecisionTrigger({
      projectId: context.projectId,
      chapterNumber,
      triggerReason: 'review_blocked',
      packet: {
        projectId: context.projectId,
        chapterNumber,
        issues: parsedReview.issues,
        rewriteInstructions: parsedReview.rewriteInstructions,
        rewriteCount
      }
    });

    return {
      ...context,
      reviewDecision: 'blocked_for_manual_decision'
    };
  }

  throw new Error('Unreachable review loop exit');
}
