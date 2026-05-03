import { describe, expect, it, vi } from 'vitest';

import {
  runDirectReplyWebSearch,
  shouldSkipDirectReplyWebSearch
} from '../src/session/coordinator/direct-reply-web-search';

describe('direct-reply-web-search', () => {
  describe('shouldSkipDirectReplyWebSearch', () => {
    it('skips short greetings and acknowledgements', () => {
      expect(shouldSkipDirectReplyWebSearch('你好')).toBe(true);
      expect(shouldSkipDirectReplyWebSearch('谢谢')).toBe(true);
      expect(shouldSkipDirectReplyWebSearch('hi')).toBe(true);
      expect(shouldSkipDirectReplyWebSearch('ok')).toBe(true);
    });

    it('does not skip substantive questions', () => {
      expect(shouldSkipDirectReplyWebSearch('Docker 镜像和容器的区别是什么')).toBe(false);
      expect(shouldSkipDirectReplyWebSearch('海外直播产品需要什么')).toBe(false);
    });
  });

  describe('runDirectReplyWebSearch', () => {
    it('calls searchFn and returns structured results', async () => {
      const searchFn = vi.fn().mockResolvedValue({
        results: [
          { url: 'https://docs.docker.com/overview/', title: 'Docker overview', summary: 'Get started with Docker' },
          { url: 'https://dev.to/docker', title: 'Docker basics', summary: 'Learn Docker basics' }
        ]
      });

      const result = await runDirectReplyWebSearch({
        query: 'Docker 镜像与容器区别',
        searchFn
      });

      expect(searchFn).toHaveBeenCalledWith('Docker 镜像与容器区别');
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].sourceUrl).toBe('https://docs.docker.com/overview/');
      expect(result.sources[0].summary).toBe('Docker overview');
      expect(result.contextSnippet).toContain('Docker overview');
      expect(result.topHosts).toContain('docs.docker.com');
    });

    it('returns empty results when searchFn throws', async () => {
      const searchFn = vi.fn().mockRejectedValue(new Error('network error'));

      const result = await runDirectReplyWebSearch({
        query: '测试搜索',
        searchFn
      });

      expect(result.sources).toHaveLength(0);
      expect(result.contextSnippet).toBe('');
      expect(result.topHosts).toHaveLength(0);
    });

    it('caps results at 5', async () => {
      const searchFn = vi.fn().mockResolvedValue({
        results: Array.from({ length: 20 }, (_, i) => ({
          url: `https://example.com/page-${i}`,
          title: `Result ${i}`,
          summary: `Summary ${i}`
        }))
      });

      const result = await runDirectReplyWebSearch({
        query: '很多结果',
        searchFn
      });

      expect(result.sources.length).toBeLessThanOrEqual(5);
    });
  });
});
