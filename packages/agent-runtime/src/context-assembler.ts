interface ChapterDraftContextInput {
  chapterPlan: string;
  recentSummaries: string[];
  fullTextHistory: string[];
}

export function assembleChapterDraftContext(input: ChapterDraftContextInput): string {
  return [
    '## Current Chapter Plan',
    input.chapterPlan,
    '## Recent Summaries',
    ...input.recentSummaries
  ].join('\n');
}
