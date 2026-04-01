import { describe, expect, it } from 'vitest';
import {
  generateChapterFlow,
  generateOutlineFlow,
  generateVolumeFlow,
  reviewRewriteFlow
} from '../../packages/workflows/src';

describe('phase 2 smoke', () => {
  it('exposes the production flows needed for the first real novel pipeline', () => {
    expect(generateOutlineFlow().name).toBe('generate-outline-flow');
    expect(generateVolumeFlow().name).toBe('generate-volume-flow');
    expect(generateChapterFlow().name).toBe('generate-chapter-flow');
    expect(reviewRewriteFlow().name).toBe('review-rewrite-flow');
  });
});
