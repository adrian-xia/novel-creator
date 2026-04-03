import { describe, expectTypeOf, it } from 'vitest';
import type {
  ExportBatchRequest,
  ExportPreview,
  ExportableChapter,
  GeneratedExport
} from '../../packages/domain/src';

describe('phase 4 export execution contracts', () => {
  it('exports synchronous export request and response types', () => {
    expectTypeOf<ExportableChapter>().toEqualTypeOf<{
      projectId: string;
      chapterNumber: number;
      title: string;
      summary: string;
      updatedAt: string;
    }>();

    expectTypeOf<ExportBatchRequest>().toEqualTypeOf<{
      projectId: string;
      chapterNumbers: number[];
      format: 'plain_text' | 'markdown' | 'bundle';
    }>();

    expectTypeOf<ExportPreview>().toMatchTypeOf<{
      projectId: string;
      chapterNumbers: number[];
      format: 'plain_text' | 'markdown' | 'bundle';
      chapterCount: number;
      chapterSummaries: Array<{
        chapterNumber: number;
        title: string;
        summary: string;
        wordCount: number;
      }>;
    }>();

    expectTypeOf<GeneratedExport>().toEqualTypeOf<{
      fileName: string;
      contentType: string;
      content: string | Uint8Array;
      kind: 'text' | 'binary';
    }>();
  });
});
