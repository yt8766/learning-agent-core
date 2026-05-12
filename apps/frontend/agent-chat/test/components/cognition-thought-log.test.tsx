import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CognitionThoughtLog } from '@/components/cognition/cognition-thought-log';

describe('CognitionThoughtLog', () => {
  it('returns null when items array is empty', () => {
    const html = renderToStaticMarkup(<CognitionThoughtLog items={[]} variant="processing" />);

    expect(html).toBe('');
  });

  it('renders items with processing variant', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Searching documents',
            status: 'loading'
          }
        ]}
        variant="processing"
      />
    );

    expect(html).toContain('is-processing');
    expect(html).toContain('Searching documents');
    expect(html).toContain('is-loading');
  });

  it('renders items with processed variant', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Analysis complete',
            status: 'success'
          }
        ]}
        variant="processed"
      />
    );

    expect(html).toContain('is-processed');
    expect(html).toContain('Analysis complete');
    expect(html).toContain('is-success');
  });

  it('renders description when provided', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Step',
            description: 'Detailed description'
          }
        ]}
        variant="processing"
      />
    );

    expect(html).toContain('Detailed description');
  });

  it('renders content when provided', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Step',
            content: 'Content block'
          }
        ]}
        variant="processing"
      />
    );

    expect(html).toContain('Content block');
  });

  it('renders footer when provided', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Step',
            footer: 'Footer text'
          }
        ]}
        variant="processing"
      />
    );

    expect(html).toContain('Footer text');
  });

  it('applies web_search variant class', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Searching web',
            itemVariant: 'web_search',
            status: 'success'
          }
        ]}
        variant="processed"
      />
    );

    expect(html).toContain('is-search');
    expect(html).toContain('is-search-icon');
  });

  it('applies browser variant class', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Browsing',
            itemVariant: 'browser',
            status: 'success'
          }
        ]}
        variant="processed"
      />
    );

    expect(html).toContain('is-browser');
    expect(html).toContain('is-browser-icon');
  });

  it('applies reasoning variant class', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Reasoning',
            itemVariant: 'reasoning',
            status: 'success'
          }
        ]}
        variant="processed"
      />
    );

    expect(html).toContain('is-reasoning');
    expect(html).toContain('is-reasoning-dot');
  });

  it('defaults to loading status when status is not provided', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Pending step'
          }
        ]}
        variant="processing"
      />
    );

    expect(html).toContain('is-loading');
  });

  it('renders multiple items', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          { key: 'item-1', title: 'Step 1', status: 'success' },
          { key: 'item-2', title: 'Step 2', status: 'loading' },
          { key: 'item-3', title: 'Step 3', status: 'error' }
        ]}
        variant="processing"
      />
    );

    expect(html).toContain('Step 1');
    expect(html).toContain('Step 2');
    expect(html).toContain('Step 3');
  });

  it('renders web search hits as pills', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Search',
            itemVariant: 'web_search',
            status: 'success',
            hits: [
              { url: 'https://a.com', title: 'Result A', host: 'a.com' },
              { url: 'https://b.com', title: 'Result B', host: 'b.com' }
            ]
          }
        ]}
        variant="processed"
      />
    );

    expect(html).toContain('chatx-cognition-log__hits');
    expect(html).toContain('Result A');
    expect(html).toContain('Result B');
  });

  it('shows overflow button when more than MAX_VISIBLE_HITS web search hits', () => {
    const hits = Array.from({ length: 6 }, (_, i) => ({
      url: `https://example${i}.com`,
      title: `Result ${i}`,
      host: `example${i}.com`
    }));

    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Search',
            itemVariant: 'web_search',
            status: 'success',
            hits
          }
        ]}
        variant="processed"
      />
    );

    expect(html).toContain('查看全部');
  });

  it('renders browser source titles as list', () => {
    const html = renderToStaticMarkup(
      <CognitionThoughtLog
        items={[
          {
            key: 'item-1',
            title: 'Browsing',
            itemVariant: 'browser',
            status: 'success',
            hits: [
              { url: 'https://page1.com', title: 'Page 1', host: 'page1.com' },
              { url: 'https://page2.com', title: 'Page 2', host: 'page2.com' }
            ]
          }
        ]}
        variant="processed"
      />
    );

    expect(html).toContain('chatx-cognition-log__page-list');
    expect(html).toContain('Page 1');
    expect(html).toContain('Page 2');
  });
});
