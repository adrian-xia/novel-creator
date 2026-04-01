interface ChapterDraftContextInput {
  chapterPlan: string;
  recentSummaries: string[];
  fullTextHistory: string[];
}

interface OutlineContextInput {
  premise: string;
  genre: string;
  targetChapterCount: number;
}

interface ChapterPlanContextInput {
  currentVolumeSummary: string;
  recentChapterSummaries: string[];
  openForeshadowing: string[];
  chapterNumber: number;
}

export function assembleChapterDraftContext(input: ChapterDraftContextInput): string {
  return [
    '## Current Chapter Plan',
    input.chapterPlan,
    '## Recent Summaries',
    ...input.recentSummaries
  ].join('\n');
}

export function assembleOutlineContext(input: OutlineContextInput) {
  return {
    premise: input.premise,
    genre: input.genre,
    targetChapterCount: input.targetChapterCount
  };
}

export function assembleChapterPlanContext(input: ChapterPlanContextInput) {
  return input;
}
