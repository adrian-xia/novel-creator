import type { ExportFormat } from './publishing';

export interface ExportableChapter {
  projectId: string;
  chapterNumber: number;
  title: string;
  summary: string;
  updatedAt: string;
}

export interface ExportBatchRequest {
  projectId: string;
  chapterNumbers: number[];
  format: ExportFormat;
}

export interface ExportPreviewChapterSummary {
  chapterNumber: number;
  title: string;
  summary: string;
  wordCount: number;
}

export type ExportPreview =
  | {
      projectId: string;
      chapterNumbers: number[];
      format: 'plain_text' | 'markdown';
      chapterCount: number;
      content: string;
      chapterSummaries: ExportPreviewChapterSummary[];
    }
  | {
      projectId: string;
      chapterNumbers: number[];
      format: 'bundle';
      chapterCount: number;
      files: string[];
      manifest: Record<string, unknown>;
      chapterSummaries: ExportPreviewChapterSummary[];
    };

export interface GeneratedExport {
  fileName: string;
  contentType: string;
  content: string | Uint8Array;
  kind: 'text' | 'binary';
}
