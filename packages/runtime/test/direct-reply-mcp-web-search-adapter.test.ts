import { describe, expect, it, vi } from 'vitest';

import { createDirectReplyWebSearchFromMcp } from '../src/session/coordinator/direct-reply-mcp-web-search-adapter';

describe('createDirectReplyWebSearchFromMcp', () => {
  it('returns undefined when manager is missing', () => {
    expect(createDirectReplyWebSearchFromMcp(undefined)).toBeUndefined();
  });

  it('returns undefined when no web search capability is registered', () => {
    const manager = {
      hasCapability: vi.fn(() => false),
      invokeCapability: vi.fn()
    };
    expect(createDirectReplyWebSearchFromMcp(manager as never)).toBeUndefined();
    expect(manager.invokeCapability).not.toHaveBeenCalled();
  });

  it('uses webSearchPrime when available and maps results', async () => {
    const manager = {
      hasCapability: (id: string) => id === 'webSearchPrime',
      invokeCapability: vi.fn().mockResolvedValue({
        ok: true,
        rawOutput: {
          results: [
            { url: 'https://a.test', title: 'A', summary: 'sa' },
            { url: 'https://b.test', title: 'B' }
          ]
        },
        durationMs: 12,
        outputSummary: 'ok'
      })
    };
    const fn = createDirectReplyWebSearchFromMcp(manager as never);
    expect(fn).toBeDefined();
    const out = await fn!('brew mac');
    expect(out.results).toHaveLength(2);
    expect(out.results[0]).toEqual({ url: 'https://a.test', title: 'A', summary: 'sa' });
    expect(out.results[1]?.url).toBe('https://b.test');
    expect(manager.invokeCapability).toHaveBeenCalledWith(
      'webSearchPrime',
      expect.objectContaining({
        input: expect.objectContaining({ query: 'brew mac' })
      })
    );
  });

  it('falls back to minimax:web_search when webSearchPrime is absent', async () => {
    const manager = {
      hasCapability: (id: string) => id === 'minimax:web_search',
      invokeCapability: vi.fn().mockResolvedValue({
        ok: true,
        rawOutput: {
          results: [{ url: 'https://m.test', title: 'M', snippet: 'snip' }]
        },
        durationMs: 5,
        outputSummary: 'ok'
      })
    };
    const fn = createDirectReplyWebSearchFromMcp(manager as never);
    const out = await fn!('q');
    expect(out.results).toHaveLength(1);
    expect(out.results[0]?.summary).toBe('snip');
    expect(manager.invokeCapability).toHaveBeenCalledWith(
      'minimax:web_search',
      expect.objectContaining({ toolName: 'web_search' })
    );
  });

  it('returns empty results when invocation fails', async () => {
    const manager = {
      hasCapability: () => true,
      invokeCapability: vi.fn().mockResolvedValue({
        ok: false,
        durationMs: 0,
        outputSummary: 'nope'
      })
    };
    const fn = createDirectReplyWebSearchFromMcp(manager as never);
    await expect(fn!('x')).resolves.toEqual({ results: [] });
  });
});
