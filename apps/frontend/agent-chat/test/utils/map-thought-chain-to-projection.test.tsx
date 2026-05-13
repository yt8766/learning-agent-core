import { describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/chat-home/chat-home-helpers', () => ({
  humanizeOperationalCopy: (value?: string) => value ?? ''
}));

import { mapThoughtChainToProjectionItems } from '@/utils/map-thought-chain-to-projection';

describe('mapThoughtChainToProjectionItems', () => {
  it('returns empty array when chain is undefined', () => {
    expect(mapThoughtChainToProjectionItems(undefined)).toEqual([]);
  });

  it('returns empty array when chain is empty', () => {
    expect(mapThoughtChainToProjectionItems([])).toEqual([]);
  });

  it('maps a basic reasoning item with prose content', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'reasoning-1',
        kind: 'reasoning',
        title: 'Thinking',
        content: 'Step by step analysis'
      }
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('reasoning-1');
    expect(items[0].title).toBe('Thinking');
    expect(items[0].itemVariant).toBe('reasoning');
  });

  it('maps a reasoning item with description', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'reasoning-2',
        kind: 'reasoning',
        title: 'Analysis',
        description: 'Detailed step',
        content: 'Some reasoning'
      }
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Detailed step');
  });

  it('maps a web_search item with hits', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'search-1',
        kind: 'web_search',
        title: 'Searching web',
        webSearch: {
          query: 'test query',
          hits: [
            { url: 'https://example.com/page', title: 'Example Page', host: 'example.com' },
            { url: 'https://test.org', host: 'test.org' }
          ]
        }
      }
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].hits).toHaveLength(2);
    expect(items[0].hits![0].url).toBe('https://example.com/page');
    expect(items[0].hits![0].title).toBe('Example Page');
    expect(items[0].hits![0].host).toBe('example.com');
    expect(items[0].hits![1].title).toBe('test.org');
  });

  it('maps a web_search item with topHosts fallback', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'search-2',
        kind: 'web_search',
        title: 'Host search',
        webSearch: {
          query: 'host query',
          topHosts: ['github.com', 'stackoverflow.com']
        }
      }
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].hits).toHaveLength(2);
    expect(items[0].hits![0].url).toBe('https://github.com');
    expect(items[0].hits![0].host).toBe('github.com');
    expect(items[0].hits![1].url).toBe('https://stackoverflow.com');
  });

  it('returns undefined hits when webSearch has no hits or topHosts', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'search-3',
        kind: 'web_search',
        title: 'Empty search',
        webSearch: { query: 'empty' }
      }
    ]);

    expect(items[0].hits).toBeUndefined();
  });

  it('maps a browser item with pages', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'browser-1',
        kind: 'browser',
        title: 'Browsing',
        browser: {
          pages: [
            { url: 'https://docs.example.com/api', title: 'API Docs', host: 'docs.example.com' },
            { url: 'https://invalid-url', host: 'invalid-url' }
          ]
        }
      }
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].hits).toHaveLength(2);
    expect(items[0].hits![0].url).toBe('https://docs.example.com/api');
    expect(items[0].hits![0].title).toBe('API Docs');
  });

  it('returns undefined hits when browser has no pages', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'browser-2',
        kind: 'browser',
        title: 'Empty browser',
        browser: { pages: [] }
      }
    ]);

    expect(items[0].hits).toBeUndefined();
  });

  it('maps status and collapsible fields', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'item-1',
        kind: 'reasoning',
        title: 'Status test',
        content: 'content',
        status: 'success',
        collapsible: true,
        blink: false,
        footer: 'footer text'
      }
    ]);

    expect(items[0].status).toBe('success');
    expect(items[0].collapsible).toBe(true);
    expect(items[0].blink).toBe(false);
    expect(items[0].footer).toBe('footer text');
  });

  it('maps items without kind', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'generic-1',
        title: 'Generic item',
        description: 'A generic thought'
      }
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].itemVariant).toBeUndefined();
    expect(items[0].hits).toBeUndefined();
  });

  it('handles webSearch hits with missing title/host fallback to url', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'search-4',
        kind: 'web_search',
        title: 'Fallback search',
        webSearch: {
          query: 'fallback',
          hits: [{ url: 'https://fallback.com' }]
        }
      }
    ]);

    expect(items[0].hits![0].title).toBe('https://fallback.com');
  });

  it('handles browser pages with missing title/host', () => {
    const items = mapThoughtChainToProjectionItems([
      {
        key: 'browser-3',
        kind: 'browser',
        title: 'Browser fallback',
        browser: {
          pages: [{ url: 'https://page.com' }]
        }
      }
    ]);

    expect(items[0].hits![0].title).toBe('https://page.com');
    expect(items[0].hits![0].host).toBe('page.com');
  });

  it('handles multiple items of different kinds', () => {
    const items = mapThoughtChainToProjectionItems([
      { key: 'r1', kind: 'reasoning', title: 'Think', content: 'analysis' },
      { key: 's1', kind: 'web_search', title: 'Search', webSearch: { query: 'search', topHosts: ['a.com'] } },
      { key: 'b1', kind: 'browser', title: 'Browse', browser: { pages: [{ url: 'https://b.com' }] } }
    ]);

    expect(items).toHaveLength(3);
    expect(items[0].itemVariant).toBe('reasoning');
    expect(items[1].itemVariant).toBe('web_search');
    expect(items[2].itemVariant).toBe('browser');
  });
});
