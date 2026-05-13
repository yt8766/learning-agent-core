import { describe, expect, it } from 'vitest';

import {
  shouldSkipDirectReplyWebSearch,
  runDirectReplyWebSearch
} from '../src/session/coordinator/direct-reply-web-search';

describe('direct-reply-web-search (direct)', () => {
  describe('shouldSkipDirectReplyWebSearch', () => {
    it('returns true for empty message', () => {
      expect(shouldSkipDirectReplyWebSearch('')).toBe(true);
    });

    it('returns true for short greeting "hi"', () => {
      expect(shouldSkipDirectReplyWebSearch('hi')).toBe(true);
    });

    it('returns true for "hello"', () => {
      expect(shouldSkipDirectReplyWebSearch('hello')).toBe(true);
    });

    it('returns true for Chinese greeting "你好"', () => {
      expect(shouldSkipDirectReplyWebSearch('你好')).toBe(true);
    });

    it('returns true for "ok"', () => {
      expect(shouldSkipDirectReplyWebSearch('ok')).toBe(true);
    });

    it('returns true for "thanks"', () => {
      expect(shouldSkipDirectReplyWebSearch('thanks')).toBe(true);
    });

    it('returns true for "谢谢"', () => {
      expect(shouldSkipDirectReplyWebSearch('谢谢')).toBe(true);
    });

    it('returns true for "嗯"', () => {
      expect(shouldSkipDirectReplyWebSearch('嗯')).toBe(true);
    });

    it('returns true for "bye"', () => {
      expect(shouldSkipDirectReplyWebSearch('bye')).toBe(true);
    });

    it('returns true for short message with punctuation', () => {
      expect(shouldSkipDirectReplyWebSearch('ok!')).toBe(true);
    });

    it('returns false for longer message', () => {
      expect(shouldSkipDirectReplyWebSearch('What is the capital of France?')).toBe(false);
    });

    it('returns false for Chinese question with 3+ chars', () => {
      expect(shouldSkipDirectReplyWebSearch('今天天气怎么样')).toBe(false);
    });

    it('returns true for very short non-Chinese message', () => {
      expect(shouldSkipDirectReplyWebSearch('ab')).toBe(true);
    });
  });

  describe('runDirectReplyWebSearch', () => {
    it('returns sources from search results', async () => {
      const searchFn = async () => ({
        results: [
          { url: 'https://example.com/page1', title: 'Page 1', summary: 'Summary 1' },
          { url: 'https://example.com/page2', title: 'Page 2' }
        ]
      });
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn, taskId: 't1' });
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].sourceUrl).toBe('https://example.com/page1');
      expect(result.sources[0].summary).toBe('Page 1');
      expect(result.sources[0].taskId).toBe('t1');
    });

    it('extracts topHosts from URLs', async () => {
      const searchFn = async () => ({
        results: [
          { url: 'https://example.com/page1', title: 'Page 1' },
          { url: 'https://other.com/page2', title: 'Page 2' },
          { url: 'https://example.com/page3', title: 'Page 3' }
        ]
      });
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn });
      expect(result.topHosts).toContain('example.com');
      expect(result.topHosts).toContain('other.com');
      expect(result.topHosts.length).toBeLessThanOrEqual(6);
    });

    it('builds contextSnippet from results', async () => {
      const searchFn = async () => ({
        results: [{ url: 'https://example.com', title: 'Example', summary: 'An example site' }]
      });
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn });
      expect(result.contextSnippet).toContain('Example');
      expect(result.contextSnippet).toContain('https://example.com');
      expect(result.contextSnippet).toContain('An example site');
    });

    it('caps results at 5', async () => {
      const searchFn = async () => ({
        results: Array.from({ length: 10 }, (_, i) => ({
          url: `https://example.com/page${i}`,
          title: `Page ${i}`
        }))
      });
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn });
      expect(result.sources).toHaveLength(5);
    });

    it('filters out results without url', async () => {
      const searchFn = async () => ({
        results: [
          { url: 'https://example.com', title: 'Valid' },
          { title: 'No URL' } as any,
          { url: 123, title: 'Bad URL' } as any
        ]
      });
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn });
      expect(result.sources).toHaveLength(1);
    });

    it('handles search function error gracefully', async () => {
      const searchFn = async () => {
        throw new Error('search failed');
      };
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn });
      expect(result.sources).toEqual([]);
      expect(result.topHosts).toEqual([]);
      expect(result.contextSnippet).toBe('');
    });

    it('handles non-array results', async () => {
      const searchFn = async () => ({ results: null }) as any;
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn });
      expect(result.sources).toEqual([]);
    });

    it('uses default title for results without title', async () => {
      const searchFn = async () => ({
        results: [{ url: 'https://example.com', title: '' }]
      });
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn });
      expect(result.sources[0].summary).toBe('网页搜索结果');
    });

    it('generates taskId when not provided', async () => {
      const searchFn = async () => ({
        results: [{ url: 'https://example.com', title: 'Test' }]
      });
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn });
      expect(result.sources[0].taskId).toMatch(/^direct:/);
    });

    it('handles malformed URLs in topHosts extraction', async () => {
      const searchFn = async () => ({
        results: [
          { url: 'not-a-valid-url', title: 'Bad URL' },
          { url: 'https://valid.com', title: 'Valid' }
        ]
      });
      const result = await runDirectReplyWebSearch({ query: 'test', searchFn });
      expect(result.topHosts).toContain('valid.com');
    });
  });
});
