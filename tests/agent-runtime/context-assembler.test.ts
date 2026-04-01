import { describe, expect, it } from 'vitest';
import {
  assembleChapterDraftContext,
  assembleChapterPlanContext,
  assembleOutlineContext
} from '../../packages/agent-runtime/src/context-assembler';

describe('context assembler', () => {
  it('builds outline context with style and platform constraints', () => {
    const context = assembleOutlineContext({
      premise: '寒门书生误入仙门迷局',
      genre: '仙侠悬疑',
      targetChapterCount: 120,
      styleGuide: ['节奏紧凑', '反转要克制'],
      forbiddenElements: ['系统面板', '现代网络梗'],
      platformConstraints: ['适配女频平台', '单章结尾要有钩子']
    });

    expect(context).toEqual({
      premise: '寒门书生误入仙门迷局',
      genre: '仙侠悬疑',
      targetChapterCount: 120,
      styleGuide: ['节奏紧凑', '反转要克制'],
      forbiddenElements: ['系统面板', '现代网络梗'],
      platformConstraints: ['适配女频平台', '单章结尾要有钩子']
    });
  });

  it('builds chapter plan context with confirmed facts and current position', () => {
    const context = assembleChapterPlanContext({
      currentVolumeSummary: '主角已锁定幕后黑手是郡守幕僚',
      recentChapterSummaries: ['夜访书库', '追索密信'],
      openForeshadowing: ['黑伞客身份未明'],
      confirmedFacts: ['主角不会御剑', '郡守三日后设宴'],
      currentPosition: { nextChapterNumber: 13, currentVolumeNumber: 2 },
      chapterNumber: 13
    });

    expect(context).toEqual({
      currentVolumeSummary: '主角已锁定幕后黑手是郡守幕僚',
      recentChapterSummaries: ['夜访书库', '追索密信'],
      openForeshadowing: ['黑伞客身份未明'],
      confirmedFacts: ['主角不会御剑', '郡守三日后设宴'],
      currentPosition: { nextChapterNumber: 13, currentVolumeNumber: 2 },
      chapterNumber: 13
    });
  });

  it('includes current constraints for chapter drafting while omitting full historical chapters', () => {
    const context = assembleChapterDraftContext({
      chapterPlan: '本章计划：设宴试探幕后耳目',
      currentVolumeSummary: '第二卷聚焦郡城迷案',
      recentSummaries: ['第十章摘要', '第十一章摘要'],
      styleGuide: ['冷峻克制', '动作描写要短促'],
      voiceConstraints: ['保持第三人称近距离视角'],
      hardFacts: ['主角左肩有旧伤', '黑伞客用左手剑'],
      fullTextHistory: ['第一章全文', '第二章全文']
    });

    expect(context).toContain('本章计划：设宴试探幕后耳目');
    expect(context).toContain('第二卷聚焦郡城迷案');
    expect(context).toContain('冷峻克制');
    expect(context).toContain('保持第三人称近距离视角');
    expect(context).toContain('主角左肩有旧伤');
    expect(context).not.toContain('第一章全文');
  });
});
