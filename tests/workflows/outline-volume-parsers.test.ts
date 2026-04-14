import { describe, expect, it } from 'vitest';
import {
  parseOutlineOutput,
  parseVolumeOutput
} from '../../packages/workflows/src/outline-volume-parsers';

describe('outline and volume parsers', () => {
  it('separates story bible text from the persisted outline payload', () => {
    expect(
      parseOutlineOutput({
        title: '卷一',
        acts: ['开局', '入宗'],
        storyBible: '宗门与王朝对峙'
      })
    ).toEqual({
      outline: {
        title: '卷一',
        acts: ['开局', '入宗']
      },
      storyBible: '宗门与王朝对峙'
    });
  });

  it('rejects an outline payload without a usable title', () => {
    expect(() => parseOutlineOutput({ title: '   ' })).toThrow(
      'Invalid outline output: missing title'
    );
  });

  it('serializes structured story bible payloads instead of dropping them', () => {
    expect(
      parseOutlineOutput({
        title: '卷一',
        storyBible: {
          factions: ['天剑宗', '药王谷'],
          protagonist: {
            name: '林弃'
          }
        }
      })
    ).toEqual({
      outline: {
        title: '卷一'
      },
      storyBible: JSON.stringify(
        {
          factions: ['天剑宗', '药王谷'],
          protagonist: {
            name: '林弃'
          }
        },
        null,
        2
      )
    });
  });

  it('normalizes volume numbers while preserving the validated plan payloads', () => {
    expect(
      parseVolumeOutput({
        plans: [{ goal: '入宗' }, { volumeNumber: 2, title: '立足' }]
      })
    ).toEqual({
      plans: [
        { goal: '入宗', volumeNumber: 1 },
        { volumeNumber: 2, title: '立足' }
      ]
    });
  });

  it('rejects malformed volume plans', () => {
    expect(() => parseVolumeOutput({ plans: [{ volumeNumber: 0 }] })).toThrow(
      'Invalid volume output: plan 1 has invalid volumeNumber'
    );
  });
});
