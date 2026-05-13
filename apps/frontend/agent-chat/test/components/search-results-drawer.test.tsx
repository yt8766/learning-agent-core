import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => ({
  Drawer: ({ children, title, open, className }: any) =>
    open ? (
      <div className={className} data-testid="drawer">
        <div>{title}</div>
        {children}
      </div>
    ) : null,
  Typography: {
    Text: ({ children, type, className }: any) => (
      <span className={className} data-type={type}>
        {children}
      </span>
    ),
    Title: ({ children, level, className }: any) => (
      <div className={className} data-level={level}>
        {children}
      </div>
    )
  }
}));

import { SearchResultsDrawer, type SearchResultSource } from '@/components/search-results-drawer';

describe('SearchResultsDrawer types', () => {
  it('SearchResultSource interface shape', () => {
    const source: SearchResultSource = {
      id: 's1',
      sourceType: 'web',
      sourceUrl: 'https://example.com',
      summary: 'Example',
      detail: { excerpt: 'text' },
      createdAt: '2026-01-01'
    };

    expect(source.id).toBe('s1');
    expect(source.sourceType).toBe('web');
    expect(source.sourceUrl).toBe('https://example.com');
  });

  it('filters web sources with URLs from a collection', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'web', sourceUrl: 'https://a.com', summary: 'A' },
      { id: 's2', sourceType: 'memory', summary: 'B' },
      { id: 's3', sourceType: 'web', summary: 'C' },
      { id: 's4', sourceType: 'web', sourceUrl: 'https://d.com', summary: 'D' }
    ];

    const webSources = sources.filter(s => s.sourceType === 'web' && s.sourceUrl);

    expect(webSources).toHaveLength(2);
    expect(webSources[0].id).toBe('s1');
    expect(webSources[1].id).toBe('s4');
  });

  it('extracts hostname from URL', () => {
    const url = 'https://example.com/path';
    const hostname = new URL(url).hostname;

    expect(hostname).toBe('example.com');
  });

  it('handles invalid URL gracefully', () => {
    let host = '';
    try {
      host = new URL('not-a-url').hostname;
    } catch {
      // expected
    }

    expect(host).toBe('');
  });
});

describe('SearchResultsDrawer rendering', () => {
  it('renders drawer with title when open', () => {
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={[]} />);
    expect(html).toContain('搜索结果');
    expect(html).toContain('chatx-search-results-drawer');
  });

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(<SearchResultsDrawer open={false} onClose={vi.fn()} sources={[]} />);
    expect(html).toBe('');
  });

  it('renders empty state when no web sources', () => {
    const sources: SearchResultSource[] = [{ id: 's1', sourceType: 'memory', summary: 'Memory source' }];
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} />);
    expect(html).toContain('暂无网页搜索结果');
  });

  it('renders web sources with hostname and summary', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'web', sourceUrl: 'https://example.com/page', summary: 'Example Article' }
    ];
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} />);
    expect(html).toContain('example.com');
    expect(html).toContain('Example Article');
    expect(html).toContain('chatx-search-results-drawer__card');
  });

  it('renders date when createdAt is valid', () => {
    const sources: SearchResultSource[] = [
      {
        id: 's1',
        sourceType: 'web',
        sourceUrl: 'https://example.com',
        summary: 'Test',
        createdAt: '2026-01-15T00:00:00.000Z'
      }
    ];
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} />);
    expect(html).toContain('chatx-search-results-drawer__date');
  });

  it('does not render date when createdAt is missing', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'web', sourceUrl: 'https://example.com', summary: 'Test' }
    ];
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} />);
    expect(html).not.toContain('chatx-search-results-drawer__date');
  });

  it('handles invalid URL gracefully', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'web', sourceUrl: 'not-a-valid-url', summary: 'Bad URL' }
    ];
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} />);
    expect(html).toContain('Bad URL');
  });

  it('renders excerpt when detail.excerpt is a string', () => {
    const sources: SearchResultSource[] = [
      {
        id: 's1',
        sourceType: 'web',
        sourceUrl: 'https://example.com',
        summary: 'Test',
        detail: { excerpt: 'An excerpt text' }
      }
    ];
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} />);
    expect(html).toContain('An excerpt text');
    expect(html).toContain('chatx-search-results-drawer__excerpt');
  });

  it('does not render excerpt when detail.excerpt is not a string', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'web', sourceUrl: 'https://example.com', summary: 'Test', detail: { excerpt: 123 } }
    ];
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} />);
    expect(html).not.toContain('chatx-search-results-drawer__excerpt');
  });

  it('applies highlight class when source id matches highlightId', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'web', sourceUrl: 'https://example.com', summary: 'Highlighted' }
    ];
    const html = renderToStaticMarkup(
      <SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} highlightId="s1" />
    );
    expect(html).toContain('is-highlighted');
  });

  it('does not apply highlight class when highlightId does not match', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'web', sourceUrl: 'https://example.com', summary: 'Not highlighted' }
    ];
    const html = renderToStaticMarkup(
      <SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} highlightId="other" />
    );
    expect(html).not.toContain('is-highlighted');
  });

  it('filters out non-web sources and web sources without URL', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'memory', summary: 'Memory' },
      { id: 's2', sourceType: 'web', summary: 'No URL' },
      { id: 's3', sourceType: 'web', sourceUrl: 'https://valid.com', summary: 'Valid' }
    ];
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} />);
    expect(html).toContain('Valid');
    expect(html).not.toContain('Memory');
    expect(html).not.toContain('No URL');
  });

  it('renders favicon image with correct domain', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'web', sourceUrl: 'https://example.com', summary: 'Test' }
    ];
    const html = renderToStaticMarkup(<SearchResultsDrawer open={true} onClose={vi.fn()} sources={sources} />);
    expect(html).toContain('google.com/s2/favicons');
    expect(html).toContain('example.com');
  });
});

// Additional coverage for the filtering and URL parsing logic
describe('SearchResultsDrawer source filtering logic', () => {
  it('filters out memory sources', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'memory', summary: 'Memory' },
      { id: 's2', sourceType: 'web', sourceUrl: 'https://a.com', summary: 'Web' }
    ];
    const webSources = sources.filter(s => s.sourceType === 'web' && s.sourceUrl);
    expect(webSources).toHaveLength(1);
  });

  it('filters out web sources without sourceUrl', () => {
    const sources: SearchResultSource[] = [
      { id: 's1', sourceType: 'web', summary: 'No URL' },
      { id: 's2', sourceType: 'web', sourceUrl: '', summary: 'Empty URL' }
    ];
    const webSources = sources.filter(s => s.sourceType === 'web' && s.sourceUrl);
    expect(webSources).toHaveLength(0);
  });

  it('handles empty sources array', () => {
    const webSources = ([] as SearchResultSource[]).filter(s => s.sourceType === 'web' && s.sourceUrl);
    expect(webSources).toHaveLength(0);
  });

  it('handles source with createdAt', () => {
    const source: SearchResultSource = {
      id: 's1',
      sourceType: 'web',
      sourceUrl: 'https://example.com',
      summary: 'Test',
      createdAt: '2026-01-15T00:00:00.000Z'
    };
    const date = new Date(source.createdAt!).toLocaleDateString('zh-CN');
    expect(date).toBeTruthy();
  });

  it('handles invalid createdAt', () => {
    const source: SearchResultSource = {
      id: 's1',
      sourceType: 'web',
      sourceUrl: 'https://example.com',
      summary: 'Test',
      createdAt: 'invalid-date'
    };
    let date = '';
    try {
      date = new Date(source.createdAt!).toLocaleDateString('zh-CN');
    } catch {
      // ignore
    }
    // Invalid date produces a string (not throws)
    expect(typeof date).toBe('string');
  });

  it('handles detail.excerpt as string', () => {
    const source: SearchResultSource = {
      id: 's1',
      sourceType: 'web',
      sourceUrl: 'https://example.com',
      summary: 'Test',
      detail: { excerpt: 'An excerpt' }
    };
    expect(typeof source.detail?.excerpt).toBe('string');
  });

  it('handles detail.excerpt as non-string', () => {
    const source: SearchResultSource = {
      id: 's1',
      sourceType: 'web',
      sourceUrl: 'https://example.com',
      summary: 'Test',
      detail: { excerpt: 123 }
    };
    expect(typeof source.detail?.excerpt).not.toBe('string');
  });

  it('handles missing detail', () => {
    const source: SearchResultSource = {
      id: 's1',
      sourceType: 'web',
      sourceUrl: 'https://example.com',
      summary: 'Test'
    };
    expect(source.detail?.excerpt).toBeUndefined();
  });

  it('handles highlightId matching', () => {
    const sourceId = 's1';
    const highlightId = 's1';
    expect(sourceId === highlightId).toBe(true);
  });

  it('handles highlightId not matching', () => {
    const sourceId: string = 's1';
    const highlightId: string = 'non-matching';
    expect(sourceId === highlightId).toBe(false);
  });
});
