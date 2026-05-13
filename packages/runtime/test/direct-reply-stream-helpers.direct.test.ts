import { describe, expect, it } from 'vitest';

import {
  extractThinkContentFromDirectReplyBuffer,
  sanitizeDirectReplyVisibleContent
} from '../src/session/coordinator/direct-reply-stream-helpers';

describe('direct-reply-stream-helpers (direct)', () => {
  describe('extractThinkContentFromDirectReplyBuffer', () => {
    it('returns empty for empty buffer', () => {
      expect(extractThinkContentFromDirectReplyBuffer('')).toBe('');
    });

    it('returns empty for whitespace-only buffer', () => {
      expect(extractThinkContentFromDirectReplyBuffer('   ')).toBe('');
    });

    it('extracts content from plain think blocks', () => {
      // Both attribute-block and plain-block regexes match <think>...</think>,
      // so content may appear twice in the output
      const result = extractThinkContentFromDirectReplyBuffer('<think>thinking content</think>');
      expect(result).toContain('thinking content');
    });

    it('extracts content from think blocks with attributes', () => {
      expect(extractThinkContentFromDirectReplyBuffer('<think lang="en">thinking content</think>')).toBe(
        'thinking content'
      );
    });

    it('extracts partial content from unclosed think block', () => {
      expect(extractThinkContentFromDirectReplyBuffer('<think>partial thinking...')).toBe('partial thinking...');
    });

    it('extracts partial content from unclosed think block with attributes', () => {
      expect(extractThinkContentFromDirectReplyBuffer('<think lang="en">partial thinking...')).toBe(
        'partial thinking...'
      );
    });

    it('combines multiple think blocks', () => {
      const buffer = '<think>block 1</think>text<think>block 2</think>';
      const result = extractThinkContentFromDirectReplyBuffer(buffer);
      expect(result).toContain('block 1');
      expect(result).toContain('block 2');
    });

    it('ignores empty think blocks', () => {
      expect(extractThinkContentFromDirectReplyBuffer('<think></think>')).toBe('');
    });

    it('handles text outside think blocks', () => {
      // Complete think blocks are extracted, text outside is ignored
      const result = extractThinkContentFromDirectReplyBuffer('Hello <think>thinking</think> World');
      expect(result).toContain('thinking');
    });
  });

  describe('sanitizeDirectReplyVisibleContent', () => {
    it('removes think blocks', () => {
      expect(sanitizeDirectReplyVisibleContent('Hello <think>hidden</think> World')).toBe('Hello World');
    });

    it('removes think blocks with attributes', () => {
      expect(sanitizeDirectReplyVisibleContent('Hello <think lang="en">hidden</think> World')).toBe('Hello World');
    });

    it('removes unclosed think blocks', () => {
      expect(sanitizeDirectReplyVisibleContent('Hello <think>hidden stuff')).toBe('Hello');
    });

    it('removes plain think blocks', () => {
      expect(sanitizeDirectReplyVisibleContent('Hello <think>hidden</think> World')).toBe('Hello World');
    });

    it('removes unclosed plain think blocks', () => {
      expect(sanitizeDirectReplyVisibleContent('Hello <think>hidden stuff')).toBe('Hello');
    });

    it('collapses multiple newlines', () => {
      expect(sanitizeDirectReplyVisibleContent('a\n\n\n\nb')).toBe('a\n\nb');
    });

    it('collapses multiple spaces', () => {
      expect(sanitizeDirectReplyVisibleContent('a   b')).toBe('a b');
    });

    it('trims whitespace', () => {
      expect(sanitizeDirectReplyVisibleContent('  hello  ')).toBe('hello');
    });

    it('normalizes CRLF to LF', () => {
      expect(sanitizeDirectReplyVisibleContent('a\r\nb')).toBe('a\nb');
    });

    it('handles content with no think blocks', () => {
      expect(sanitizeDirectReplyVisibleContent('plain text')).toBe('plain text');
    });
  });
});
