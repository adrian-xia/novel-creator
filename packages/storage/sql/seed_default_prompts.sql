INSERT INTO "PromptConfig" (
  "id",
  "agentName",
  "version",
  "systemPrompt",
  "taskTemplate",
  "outputSchema",
  "reviewRubric",
  "enabled",
  "lastTestedModel",
  "createdAt",
  "updatedAt"
)
VALUES
(
  '00000000-0000-0000-0000-000000000101',
  'outline-agent',
  1,
  $outline_system$You are a senior serialized-fiction architect. Build a commercially viable long-form web novel foundation with clear escalation, reader hooks, and reusable world logic.$outline_system$,
  $outline_task$Project premise:
{{premise}}

Genre:
{{genre}}

Return JSON only. Required keys: title, coreHook, theme, storyBible, protagonist, majorConflicts, volumeSeeds, openingPromise, longTermPayoffs.$outline_task$,
  '{"type":"object","required":["title","storyBible"],"properties":{"title":{"type":"string"},"coreHook":{"type":"string"},"theme":{"type":"string"},"storyBible":{"type":"string"},"protagonist":{"type":"object"},"majorConflicts":{"type":"array"},"volumeSeeds":{"type":"array"},"openingPromise":{"type":"array"},"longTermPayoffs":{"type":"array"}}}'::jsonb,
  'Check premise clarity, long-line conflict strength, protagonist differentiation, and downstream serializability.',
  true,
  'deepseek-r1',
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000102',
  'volume-agent',
  1,
  $volume_system$You are a volume planner for serialized fiction. Expand the approved foundation into clean volume-level production plans with escalating conflict and visible payoffs.$volume_system$,
  $volume_task$Premise:
{{premise}}

Genre:
{{genre}}

Approved outline:
{{outline}}

Story bible:
{{storyBible}}

Return JSON only with {"plans":[...]} and include volumeNumber, title, goal, coreConflict, keyTurns, endingHook for each plan.$volume_task$,
  '{"type":"object","required":["plans"],"properties":{"plans":{"type":"array"}}}'::jsonb,
  'Check escalation, variety between volumes, and whether each volume has a distinct promise and payoff.',
  true,
  'deepseek-r1',
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000103',
  'chapter-plan-agent',
  1,
  $chapter_plan_system$You are a chapter planner. Turn current story state into a concrete next-chapter execution plan that can be drafted immediately.$chapter_plan_system$,
  $chapter_plan_task$Next chapter number:
{{chapterNumber}}

Current position:
{{currentPosition}}

Recent chapter summaries:
{{recentChapterSummaries}}

Open foreshadowing:
{{openForeshadowing}}

Confirmed facts:
{{confirmedFacts}}

Return JSON only with title, goal, beats, povCharacter, hardConstraints.$chapter_plan_task$,
  '{"type":"object","required":["title","goal","beats"],"properties":{"title":{"type":"string"},"goal":{"type":"string"},"beats":{"type":"array"},"povCharacter":{"type":"string"},"hardConstraints":{"type":"array"}}}'::jsonb,
  'Check that the chapter plan advances conflict, respects continuity, and contains no filler beats.',
  true,
  'deepseek-r1',
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000104',
  'chapter-draft-agent',
  1,
  $chapter_draft_system$You are a web-novel drafting agent. Write an immersive, readable chapter that follows the plan, preserves continuity, and ends with enough narrative pull for the next chapter.$chapter_draft_system$,
  $chapter_draft_task$Chapter number:
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

Write the chapter body only. No markdown fences. No explanation.$chapter_draft_task$,
  '{"type":"string","description":"Plain chapter prose only."}'::jsonb,
  'Check scene readability, continuity, emotional momentum, and hook strength at the chapter ending.',
  true,
  'deepseek-r1',
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000105',
  'review-agent',
  1,
  $review_system$You are a strict chapter reviewer. Judge whether the draft is ready, should be rewritten automatically, or must stop for human decision. Focus on continuity, logic, pacing, and chapter utility.$review_system$,
  $review_task$Draft version:
{{version}}

Draft content:
{{content}}

Draft metadata:
{{metadata}}

Return JSON only with decision, summary, issues, rewriteInstructions.
decision must be one of approve, rewrite, blocked_for_manual_decision.$review_task$,
  '{"type":"object","required":["decision","issues","rewriteInstructions"],"properties":{"decision":{"type":"string"},"summary":{"type":"string"},"issues":{"type":"array"},"rewriteInstructions":{"type":"array"}}}'::jsonb,
  'Check continuity, scene logic, pacing, payoff discipline, and whether the rewrite scope is local or structural.',
  true,
  'deepseek-r1',
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000106',
  'rewrite-agent',
  1,
  $rewrite_system$You are a surgical novel reviser. Fix the reviewed issues while preserving the chapter''s intended events, continuity anchors, and readable flow.$rewrite_system$,
  $rewrite_task$Current draft:
{{content}}

Draft version:
{{version}}

Review issues:
{{issues}}

Rewrite instructions:
{{rewriteInstructions}}

Draft metadata:
{{metadata}}

Rewrite the chapter and return the revised chapter text only. No markdown fences. No JSON wrapper.$rewrite_task$,
  '{"type":"string","description":"Plain rewritten chapter prose only."}'::jsonb,
  'Check whether the revision directly addresses review issues without introducing new continuity damage.',
  true,
  'deepseek-r1',
  NOW(),
  NOW()
)
ON CONFLICT ("agentName", "version")
DO UPDATE SET
  "systemPrompt" = EXCLUDED."systemPrompt",
  "taskTemplate" = EXCLUDED."taskTemplate",
  "outputSchema" = EXCLUDED."outputSchema",
  "reviewRubric" = EXCLUDED."reviewRubric",
  "enabled" = EXCLUDED."enabled",
  "lastTestedModel" = EXCLUDED."lastTestedModel",
  "updatedAt" = NOW();
