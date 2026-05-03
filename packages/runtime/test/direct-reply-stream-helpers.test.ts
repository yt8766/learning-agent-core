import { describe, expect, it } from 'vitest';

import {
  extractThinkContentFromDirectReplyBuffer,
  sanitizeDirectReplyVisibleContent
} from '../src/session/coordinator/direct-reply-stream-helpers';

describe('direct-reply-stream-helpers', () => {
  it('extracts attribute-style think blocks', () => {
    const raw = 'Hello <think type="reasoning">plan A</think> tail';
    expect(extractThinkContentFromDirectReplyBuffer(raw)).toBe('plan A');
    expect(sanitizeDirectReplyVisibleContent(raw)).toBe('Hello tail');
  });

  it('extracts plain think blocks', () => {
    const raw = 'Hi <think>plain reasoning</think> done';
    expect(extractThinkContentFromDirectReplyBuffer(raw)).toContain('plain reasoning');
    expect(sanitizeDirectReplyVisibleContent(raw)).toBe('Hi done');
  });

  it('captures streaming partial think tails', () => {
    const partial = '<think>still streaming';
    expect(extractThinkContentFromDirectReplyBuffer(partial)).toBe('still streaming');
    expect(sanitizeDirectReplyVisibleContent(partial)).toBe('');
  });
});
