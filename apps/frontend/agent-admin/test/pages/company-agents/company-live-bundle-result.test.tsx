import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) =>
    `<span class="badge" data-variant="${variant ?? ''}">${children}</span>`
}));

import { CompanyLiveBundleResult } from '@/pages/company-agents/company-live-bundle-result';

describe('CompanyLiveBundleResult', () => {
  it('renders the result header', () => {
    const html = renderToStaticMarkup(
      <CompanyLiveBundleResult
        result={
          {
            bundle: {
              requestId: 'req-123',
              createdAt: '2026-05-01T10:00:00.000Z',
              assets: []
            }
          } as any
        }
      />
    );

    expect(html).toContain('生成结果');
    expect(html).toContain('req-123');
  });

  it('renders creation timestamp', () => {
    const html = renderToStaticMarkup(
      <CompanyLiveBundleResult
        result={
          {
            bundle: {
              requestId: 'req-123',
              createdAt: '2026-05-01T10:00:00.000Z',
              assets: []
            }
          } as any
        }
      />
    );

    expect(html).toContain('2026-05-01T10:00:00.000Z');
  });

  it('renders assets with kind, uri, and mimeType', () => {
    const html = renderToStaticMarkup(
      <CompanyLiveBundleResult
        result={
          {
            bundle: {
              requestId: 'req-456',
              createdAt: '2026-05-01T10:00:00.000Z',
              assets: [
                {
                  assetId: 'asset-1',
                  kind: 'image',
                  uri: 'https://cdn.example.com/img.png',
                  mimeType: 'image/png'
                },
                {
                  assetId: 'asset-2',
                  kind: 'text',
                  uri: 'https://cdn.example.com/doc.txt',
                  mimeType: 'text/plain',
                  provider: 'openai'
                }
              ]
            }
          } as any
        }
      />
    );

    expect(html).toContain('image');
    expect(html).toContain('https://cdn.example.com/img.png');
    expect(html).toContain('image/png');
    expect(html).toContain('text');
    expect(html).toContain('text/plain');
    expect(html).toContain('openai');
  });

  it('renders asset without provider', () => {
    const html = renderToStaticMarkup(
      <CompanyLiveBundleResult
        result={
          {
            bundle: {
              requestId: 'req-789',
              createdAt: '2026-05-01T10:00:00.000Z',
              assets: [
                {
                  assetId: 'asset-3',
                  kind: 'video',
                  uri: 'https://cdn.example.com/vid.mp4',
                  mimeType: 'video/mp4'
                }
              ]
            }
          } as any
        }
      />
    );

    expect(html).toContain('video');
    expect(html).toContain('video/mp4');
    expect(html).not.toContain(' · ');
  });

  it('renders empty assets list', () => {
    const html = renderToStaticMarkup(
      <CompanyLiveBundleResult
        result={
          {
            bundle: {
              requestId: 'req-empty',
              createdAt: '2026-05-01T10:00:00.000Z',
              assets: []
            }
          } as any
        }
      />
    );

    expect(html).toContain('生成结果');
    expect(html).toContain('req-empty');
  });
});
