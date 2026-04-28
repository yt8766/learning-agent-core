import { describe, expect, it } from 'vitest';

import { assertImageGenerationRequestAllowed } from '../src';

describe('@agent/agents-image image generation policy', () => {
  it('blocks bulk image requests without evidence refs', () => {
    expect(() =>
      assertImageGenerationRequestAllowed({
        prompt: 'A stunning product photo',
        count: 5
      })
    ).toThrow('Image generation evidence is required for bulk requests.');
  });

  it('allows single image requests without evidence refs', () => {
    const req = assertImageGenerationRequestAllowed({
      prompt: 'A stunning product photo',
      count: 1
    });
    expect(req.prompt).toBe('A stunning product photo');
  });

  it('allows bulk image requests when evidence refs are provided', () => {
    const req = assertImageGenerationRequestAllowed({
      prompt: 'Product lineup',
      count: 5,
      evidenceRefs: ['brief-001']
    });
    expect(req.count).toBe(5);
  });

  it('allows requests with no count specified', () => {
    const req = assertImageGenerationRequestAllowed({
      prompt: 'Single hero image'
    });
    expect(req.prompt).toBe('Single hero image');
  });
});
