export interface ReplanRange {
  startChapter: number;
  endChapter: number;
}

export interface ChapterRecoveryTask {
  id: string;
  projectId: string;
  sessionId: string;
  startChapter: number;
  endChapter: number;
  resumeFromChapter: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}
