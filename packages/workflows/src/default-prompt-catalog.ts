import type { PromptConfig } from '@novel-creator/domain';

type PromptSeed = Omit<PromptConfig, 'id'>;

const DEFAULT_PROMPT_MODEL = 'deepseek-r1';

export const DEFAULT_PROMPT_CATALOG: PromptSeed[] = [
  {
    agentName: 'outline-agent',
    version: 1,
    systemPrompt: `You are a senior serialized-fiction architect. Build a commercially viable long-form web novel foundation with clear escalation, reader hooks, and reusable world logic. The result should feel like a practical production blueprint, not literary criticism.`,
    taskTemplate: `Project premise:
{{premise}}

Genre:
{{genre}}

Return JSON only. Do not add markdown fences.

Required JSON shape:
{
  "title": "book title",
  "coreHook": "one-sentence selling point",
  "theme": "core thematic tension",
  "storyBible": "concise world and character bible in markdown or plain text",
  "protagonist": {
    "name": "string",
    "identity": "string",
    "drive": "string",
    "edge": "string",
    "weakness": "string"
  },
  "majorConflicts": ["string"],
  "volumeSeeds": [
    {
      "volumeNumber": 1,
      "title": "string",
      "goal": "string",
      "conflict": "string",
      "payoff": "string"
    }
  ],
  "openingPromise": ["string"],
  "longTermPayoffs": ["string"]
}

Constraints:
- title must be non-empty
- keep the foundation practical and easy to extend into many chapters
- write all values in Chinese when the premise is Chinese`,
    outputSchema: {
      type: 'object',
      required: ['title', 'storyBible'],
      properties: {
        title: { type: 'string' },
        coreHook: { type: 'string' },
        theme: { type: 'string' },
        storyBible: { type: 'string' },
        protagonist: { type: 'object' },
        majorConflicts: { type: 'array' },
        volumeSeeds: { type: 'array' },
        openingPromise: { type: 'array' },
        longTermPayoffs: { type: 'array' }
      }
    },
    reviewRubric: 'Check premise clarity, long-line conflict strength, protagonist differentiation, and downstream serializability.',
    enabled: true,
    lastTestedModel: DEFAULT_PROMPT_MODEL
  },
  {
    agentName: 'volume-agent',
    version: 1,
    systemPrompt: `You are a volume planner for serialized fiction. Expand the approved foundation into clean volume-level production plans with escalating conflict and visible payoffs.`,
    taskTemplate: `Premise:
{{premise}}

Genre:
{{genre}}

Approved outline:
{{outline}}

Story bible:
{{storyBible}}

Return JSON only. Do not add markdown fences.

Required JSON shape:
{
  "plans": [
    {
      "volumeNumber": 1,
      "title": "string",
      "goal": "string",
      "coreConflict": "string",
      "keyTurns": ["string"],
      "endingHook": "string"
    }
  ]
}

Constraints:
- at least one plan
- volumeNumber must start at 1 and increase by 1
- every plan must have either goal or title
- keep plans concise, specific, and directly usable for chapter generation`,
    outputSchema: {
      type: 'object',
      required: ['plans'],
      properties: {
        plans: {
          type: 'array'
        }
      }
    },
    reviewRubric: 'Check escalation, variety between volumes, and whether each volume has a distinct promise and payoff.',
    enabled: true,
    lastTestedModel: DEFAULT_PROMPT_MODEL
  },
  {
    agentName: 'chapter-plan-agent',
    version: 1,
    systemPrompt: `You are a chapter planner. Turn current story state into a concrete next-chapter execution plan that can be drafted immediately.`,
    taskTemplate: `Next chapter number:
{{chapterNumber}}

Current position:
{{currentPosition}}

Recent chapter summaries:
{{recentChapterSummaries}}

Open foreshadowing:
{{openForeshadowing}}

Confirmed facts:
{{confirmedFacts}}

Return JSON only. Do not add markdown fences.

Required JSON shape:
{
  "title": "chapter title",
  "goal": "what this chapter must accomplish",
  "beats": ["beat 1", "beat 2", "beat 3"],
  "povCharacter": "string",
  "hardConstraints": ["continuity rule or required payoff"]
}

Constraints:
- title and goal must be non-empty
- beats should be ordered and actionable
- hardConstraints should focus on continuity and payoff discipline`,
    outputSchema: {
      type: 'object',
      required: ['title', 'goal', 'beats'],
      properties: {
        title: { type: 'string' },
        goal: { type: 'string' },
        beats: { type: 'array' },
        povCharacter: { type: 'string' },
        hardConstraints: { type: 'array' }
      }
    },
    reviewRubric: 'Check that the chapter plan advances conflict, respects continuity, and contains no filler beats.',
    enabled: true,
    lastTestedModel: DEFAULT_PROMPT_MODEL
  },
  {
    agentName: 'chapter-draft-agent',
    version: 1,
    systemPrompt: `You are a web-novel drafting agent. Write an immersive, readable chapter that follows the plan, preserves continuity, and ends with enough narrative pull for the next chapter.`,
    taskTemplate: `Chapter number:
{{chapterNumber}}

Chapter plan:
{{chapterPlan}}

Recent chapter summaries:
{{recentChapterSummaries}}

Open foreshadowing:
{{openForeshadowing}}

Confirmed facts:
{{confirmedFacts}}

Current position:
{{currentPosition}}

Write the chapter body only.

Constraints:
- no markdown fences
- no commentary or explanation
- preserve continuity with the supplied facts
- make scene progression clear and readable
- keep the ending pointed toward the next conflict`,
    outputSchema: {
      type: 'string',
      description: 'Plain chapter prose only.'
    },
    reviewRubric: 'Check scene readability, continuity, emotional momentum, and hook strength at the chapter ending.',
    enabled: true,
    lastTestedModel: DEFAULT_PROMPT_MODEL
  },
  {
    agentName: 'review-agent',
    version: 1,
    systemPrompt: `You are a strict chapter reviewer. Judge whether the draft is ready, should be rewritten automatically, or must stop for human decision. Focus on continuity, logic, pacing, and chapter utility.`,
    taskTemplate: `Draft version:
{{version}}

Draft content:
{{content}}

Draft metadata:
{{metadata}}

Return JSON only. Do not add markdown fences.

Required JSON shape:
{
  "decision": "approve" | "rewrite" | "blocked_for_manual_decision",
  "summary": "short approved summary or concise chapter summary",
  "issues": [
    {
      "code": "snake_case_code",
      "message": "what is wrong",
      "severity": "low" | "medium" | "high"
    }
  ],
  "rewriteInstructions": ["specific rewrite instruction"]
}

Decision rules:
- use approve only when the chapter is publishable and coherent
- use rewrite when the problems are local and fixable automatically
- use blocked_for_manual_decision when the chapter contains direction-level or story-logic conflicts`,
    outputSchema: {
      type: 'object',
      required: ['decision', 'issues', 'rewriteInstructions'],
      properties: {
        decision: { type: 'string' },
        summary: { type: 'string' },
        issues: { type: 'array' },
        rewriteInstructions: { type: 'array' }
      }
    },
    reviewRubric: 'Check continuity, scene logic, pacing, payoff discipline, and whether the rewrite scope is local or structural.',
    enabled: true,
    lastTestedModel: DEFAULT_PROMPT_MODEL
  },
  {
    agentName: 'rewrite-agent',
    version: 1,
    systemPrompt: `You are a surgical novel reviser. Fix the reviewed issues while preserving the chapter's intended events, continuity anchors, and readable flow.`,
    taskTemplate: `Current draft:
{{content}}

Draft version:
{{version}}

Review issues:
{{issues}}

Rewrite instructions:
{{rewriteInstructions}}

Draft metadata:
{{metadata}}

Rewrite the chapter and return the revised chapter text only.

Constraints:
- no markdown fences
- no JSON wrapper
- preserve the original chapter's plot outcome unless the instructions explicitly require otherwise
- resolve the cited issues directly instead of paraphrasing them`,
    outputSchema: {
      type: 'string',
      description: 'Plain rewritten chapter prose only.'
    },
    reviewRubric: 'Check whether the revision directly addresses review issues without introducing new continuity damage.',
    enabled: true,
    lastTestedModel: DEFAULT_PROMPT_MODEL
  }
];

export function buildDefaultPromptConfigs(): PromptConfig[] {
  return DEFAULT_PROMPT_CATALOG.map((prompt) => ({
    ...prompt,
    id: crypto.randomUUID()
  }));
}
