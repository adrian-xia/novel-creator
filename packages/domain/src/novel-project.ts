export type NovelProjectStatus =
  | 'draft'
  | 'active'
  | 'blocked'
  | 'paused'
  | 'completed';

export interface CreateNovelProjectInput {
  title: string;
  genre: string;
  premise: string;
  targetChapterCount: number;
  chaptersPerDay: number;
}

export interface NovelProject {
  id: string;
  title: string;
  genre: string;
  premise: string;
  targetChapterCount: number;
  chaptersPerDay: number;
  status: NovelProjectStatus;
}

export function createNovelProject(input: CreateNovelProjectInput): NovelProject {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    genre: input.genre,
    premise: input.premise,
    targetChapterCount: input.targetChapterCount,
    chaptersPerDay: input.chaptersPerDay,
    status: 'draft'
  };
}
