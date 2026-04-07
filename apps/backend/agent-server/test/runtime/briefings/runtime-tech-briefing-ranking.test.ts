import { describe, expect, it } from 'vitest';

import { rankItems } from '../../../src/runtime/briefings/runtime-tech-briefing-ranking';
import type { TechBriefingItem } from '../../../src/runtime/briefings/runtime-tech-briefing.types';

function createItem(overrides: Partial<TechBriefingItem>): TechBriefingItem {
  return {
    id: 'item-1',
    category: 'frontend-security',
    title: 'Axios supply chain incident',
    url: 'https://example.com/axios',
    publishedAt: '2026-03-31T00:00:00.000Z',
    sourceName: 'Example',
    sourceUrl: 'https://example.com',
    sourceType: 'security-page',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'incident',
    summary: 'axios incident summary',
    confidence: 0.9,
    sourceLabel: 'Example',
    relevanceReason: '命中当前关注技术域：axios',
    technicalityScore: 5,
    crossVerified: true,
    ...overrides
  };
}

describe('runtime tech briefing ranking', () => {
  it('保留 official-only 下的高置信 authority 前端安全事件', () => {
    const ranked = rankItems(
      'frontend-security',
      [
        createItem({ id: 'authority-incident' }),
        createItem({
          id: 'official-advisory',
          sourceGroup: 'official',
          authorityTier: 'official-advisory',
          contentKind: 'advisory',
          confidence: 0.95,
          crossVerified: false
        })
      ],
      'official-only'
    );

    expect(ranked.map(item => item.id)).toEqual(['official-advisory', 'authority-incident']);
  });

  it('保留 official-only 下的高置信 authority 开发工具安全事件', () => {
    const ranked = rankItems(
      'devtool-security',
      [
        createItem({
          id: 'claude-code-leak',
          category: 'devtool-security',
          title: 'Claude Code source code leak',
          summary: 'claude code source code exposure summary',
          relevanceReason: '命中当前关注技术域：claude code',
          sourceName: 'The Verge / Claude Code',
          sourceUrl: 'https://www.theverge.com',
          sourceGroup: 'authority'
        })
      ],
      'official-only'
    );

    expect(ranked.map(item => item.id)).toEqual(['claude-code-leak']);
  });

  it('不要求命中当前仓库已安装依赖，只要命中关注技术域即可提高相关性', () => {
    const ranked = rankItems(
      'frontend-security',
      [
        createItem({
          id: 'apifox-incident',
          title: 'Apifox official incident',
          summary: 'apifox cdn incident summary',
          relevanceReason: '命中当前关注技术域：apifox',
          sourceGroup: 'official',
          authorityTier: 'official-advisory'
        })
      ],
      'official-only'
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.relevanceReason).toContain('当前关注技术域');
  });

  it('不会在 official-only 下放行普通 authority 前端技术资讯', () => {
    const ranked = rankItems(
      'frontend-tech',
      [
        createItem({
          id: 'authority-docs-update',
          category: 'frontend-tech',
          sourceGroup: 'authority',
          contentKind: 'docs-update',
          technicalityScore: 5,
          crossVerified: true
        })
      ],
      'official-only'
    );

    expect(ranked).toEqual([]);
  });
});
