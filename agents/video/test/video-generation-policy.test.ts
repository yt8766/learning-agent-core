import { describe, expect, it } from 'vitest';

import { assertVideoGenerationRequestAllowed } from '../src';

describe('@agent/agents-video video generation policy', () => {
  it('blocks video requests with durationMs exceeding 300 seconds', () => {
    expect(() =>
      assertVideoGenerationRequestAllowed({
        prompt: 'A product reveal video',
        durationMs: 300001
      })
    ).toThrow('Video duration must not exceed 300 seconds.');
  });

  it('blocks video requests with more than 10 image asset refs', () => {
    expect(() =>
      assertVideoGenerationRequestAllowed({
        prompt: 'A slideshow video',
        imageAssetRefs: Array.from({ length: 11 }, (_, i) => `asset-${i}`)
      })
    ).toThrow('Video generation accepts at most 10 image asset refs.');
  });

  it('allows a video request with a prompt and valid durationMs', () => {
    const req = assertVideoGenerationRequestAllowed({
      prompt: 'Product reveal',
      durationMs: 30000
    });
    expect(req.prompt).toBe('Product reveal');
  });

  it('allows a video request at the exact 300 second boundary', () => {
    const req = assertVideoGenerationRequestAllowed({
      prompt: 'Max length feature video',
      durationMs: 300000
    });
    expect(req.durationMs).toBe(300000);
  });

  it('allows a video request with exactly 10 image asset refs', () => {
    const req = assertVideoGenerationRequestAllowed({
      prompt: 'Gallery slideshow',
      imageAssetRefs: Array.from({ length: 10 }, (_, i) => `asset-${i}`)
    });
    expect(req.imageAssetRefs).toHaveLength(10);
  });
});
