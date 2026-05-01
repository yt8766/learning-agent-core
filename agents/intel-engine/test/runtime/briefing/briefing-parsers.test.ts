import { describe, expect, it, vi } from 'vitest';

import { collectSecurityPageItems } from '../../../src/runtime/briefing/briefing-parsers';
import type { SecurityPageSourceRecord } from '../../../src/runtime/briefing/briefing-sources';

describe('runtime tech briefing parsers', () => {
  it('为 Apifox 官方公告使用站点 rebuild 时间作为兜底发布时间', async () => {
    const source: SecurityPageSourceRecord = {
      id: 'apifox-official-incident',
      category: 'frontend-security',
      name: 'Apifox 官方公告',
      sourceUrl: 'https://apifox.com',
      pageUrl: 'https://docs.apifox.com/6756598m0',
      sourceType: 'official-page',
      authorityTier: 'official-advisory',
      sourceGroup: 'official',
      contentKind: 'incident',
      pageKind: 'incident-page',
      parserKind: 'incident-page',
      topicTags: ['frontend-security', 'apifox', 'cdn']
    };

    const html = `
      <html>
        <head>
          <title>Apifox 帮助文档</title>
        </head>
        <body>
          <main>
            <h1>Apifox CDN 安全公告</h1>
            <p>Apifox 发布了新的安全说明，建议用户清理缓存并轮换可能暴露的 Token。</p>
          </main>
          <script>
            window.__remixContext = {
              "algoliaDocSearchRebuiltAt","2026-03-26T02:46:54.246Z"
            };
          </script>
        </body>
      </html>
    `;
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));

    const items = await collectSecurityPageItems(
      source,
      new Date('2026-04-02T10:00:00.000Z'),
      14,
      fetchImpl as typeof fetch
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.publishedAt).toBe('2026-03-26T02:46:54.246Z');
    expect(items[0]?.title).toContain('Apifox');
  });

  it('会保留 devtool-security 页面项的分类', async () => {
    const source: SecurityPageSourceRecord = {
      id: 'claude-code-workspace-trust-gitlab',
      category: 'devtool-security',
      name: 'GitLab Advisory / Claude Code',
      sourceUrl: 'https://advisories.gitlab.com/pkg/npm/%40anthropic-ai/claude-code/',
      pageUrl: 'https://advisories.gitlab.com/pkg/npm/%40anthropic-ai/claude-code/CVE-2026-21852/',
      sourceType: 'security-page',
      authorityTier: 'official-advisory',
      sourceGroup: 'official',
      contentKind: 'advisory',
      pageKind: 'gitlab-advisory',
      parserKind: 'security-advisory',
      topicTags: ['devtool-security', 'claude-code', 'advisory']
    };

    const html = `
      <html>
        <head><title>Claude Code security advisory</title></head>
        <body>
          <main>
            <h1>Claude Code workspace trust issue</h1>
            <p>Published March 30, 2026</p>
            <p>Claude Code may expose local source paths through workspace trust handling.</p>
          </main>
        </body>
      </html>
    `;
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));

    const items = await collectSecurityPageItems(
      source,
      new Date('2026-04-02T10:00:00.000Z'),
      14,
      fetchImpl as typeof fetch
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.category).toBe('devtool-security');
    expect(items[0]?.relevanceReason).toContain('开发工具');
  });
});
