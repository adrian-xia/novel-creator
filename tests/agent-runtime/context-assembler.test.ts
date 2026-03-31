import { describe, expect, it } from 'vitest';
import { assembleChapterDraftContext } from '../../packages/agent-runtime/src/context-assembler';

describe('context assembler', () => {
  it('omits full historical chapters from chapter drafting context', () => {
    const context = assembleChapterDraftContext({
      chapterPlan: '本章计划',
      recentSummaries: ['第十章摘要', '第十一章摘要'],
      fullTextHistory: ['第一章全文', '第二章全文']
    });

    expect(context).toContain('本章计划');
    expect(context).not.toContain('第一章全文');
  });
});
