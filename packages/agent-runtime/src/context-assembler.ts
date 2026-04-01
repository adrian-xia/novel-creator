interface ChapterDraftContextInput {
  chapterPlan: string;
  currentVolumeSummary: string;
  recentSummaries: string[];
  styleGuide: string[];
  voiceConstraints: string[];
  hardFacts: string[];
  fullTextHistory: string[];
}

interface OutlineContextInput {
  premise: string;
  genre: string;
  targetChapterCount: number;
  styleGuide: string[];
  forbiddenElements: string[];
  platformConstraints: string[];
}

interface ChapterPlanContextInput {
  currentVolumeSummary: string;
  recentChapterSummaries: string[];
  openForeshadowing: string[];
  confirmedFacts: string[];
  currentPosition: {
    nextChapterNumber: number;
    currentVolumeNumber: number | null;
  };
  chapterNumber: number;
}

export function assembleChapterDraftContext(input: ChapterDraftContextInput): string {
  return [
    '## Current Chapter Plan',
    input.chapterPlan,
    '## Current Volume Summary',
    input.currentVolumeSummary,
    '## Recent Summaries',
    ...input.recentSummaries,
    '## Style Guide',
    ...input.styleGuide,
    '## Voice Constraints',
    ...input.voiceConstraints,
    '## Hard Facts',
    ...input.hardFacts
  ].join('\n');
}

export function assembleOutlineContext(input: OutlineContextInput) {
  return {
    premise: input.premise,
    genre: input.genre,
    targetChapterCount: input.targetChapterCount,
    styleGuide: input.styleGuide,
    forbiddenElements: input.forbiddenElements,
    platformConstraints: input.platformConstraints
  };
}

export function assembleChapterPlanContext(input: ChapterPlanContextInput) {
  return input;
}
