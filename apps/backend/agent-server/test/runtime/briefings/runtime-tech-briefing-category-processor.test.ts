import { describe, expect, it } from 'vitest';

import {
  buildSuppressedSummary,
  decideItemForSend,
  finalizeCategoryStatus,
  limitCategoryItems,
  mergeSameRunItems
} from '../../../src/runtime/briefings/runtime-tech-briefing-category-processor';
import type { BriefingSettings } from '../../../src/runtime/briefings/runtime-tech-briefing-schedule';

const config: BriefingSettings = {
  enabled: true,
  schedule: 'daily 11:00',
  sendEmptyDigest: true,
  maxItemsPerCategory: 3,
  duplicateWindowDays: 7,
  maxNonCriticalItemsPerCategory: 1,
  maxCriticalItemsPerCategory: 1,
  maxTotalItemsPerCategory: 2,
  sendOnlyDelta: true,
  resendOnlyOnMaterialChange: true,
  larkDigestMode: 'dual',
  sourcePolicy: 'tiered-authority',
  webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
  translationEnabled: false,
  translationModel: 'glm-4.7-flashx',
  aiLookbackDays: 7,
  frontendLookbackDays: 7,
  securityLookbackDays: 7
};

describe('runtime tech briefing category processor', () => {
  it('prefers stronger and previously-sent sources when merging same-run duplicates', () => {
    const merged = mergeSameRunItems(
      [
        {
          id: '1',
          category: 'ai-tech',
          title: 'OpenAI update',
          url: 'https://example.com/1',
          publishedAt: '2026-04-16T00:00:00.000Z',
          sourceName: 'Community Blog',
          sourceUrl: 'https://community.example.com',
          sourceType: 'rss',
          authorityTier: 'top-tier-media',
          sourceGroup: 'community',
          contentKind: 'release',
          summary: 'community',
          confidence: 0.8,
          sourceLabel: 'community',
          relevanceReason: 'same topic',
          technicalityScore: 3,
          crossVerified: false,
          messageKey: 'same-topic'
        },
        {
          id: '2',
          category: 'ai-tech',
          title: 'OpenAI update',
          url: 'https://example.com/2',
          publishedAt: '2026-04-16T00:00:00.000Z',
          sourceName: 'OpenAI',
          sourceUrl: 'https://openai.com',
          sourceType: 'official-page',
          authorityTier: 'official-release',
          sourceGroup: 'official',
          contentKind: 'release',
          summary: 'official',
          confidence: 0.9,
          sourceLabel: 'official',
          relevanceReason: 'same topic',
          technicalityScore: 3,
          crossVerified: false,
          messageKey: 'same-topic'
        }
      ],
      new Map([
        [
          'same-topic',
          {
            messageKey: 'same-topic',
            category: 'ai-tech',
            firstSeenAt: '2026-04-10T00:00:00.000Z',
            firstSentAt: '2026-04-10T00:00:00.000Z',
            lastSentAt: '2026-04-10T00:00:00.000Z',
            lastPublishedAt: '2026-04-10T00:00:00.000Z',
            lastContentFingerprint: 'fp',
            lastContentChangeAt: '2026-04-10T00:00:00.000Z',
            lastTitle: 'OpenAI update',
            lastUrl: 'https://example.com/2',
            lastSourceName: 'OpenAI',
            lastDecision: 'send_new'
          }
        ]
      ])
    );

    expect(merged.sameRunMergedCount).toBe(1);
    expect(merged.primaryItems[0]?.sourceName).toBe('OpenAI');
    expect(merged.primaryItems[0]?.crossVerified).toBe(true);
  });

  it('respects duplicate windows and category display limits', () => {
    const decided = decideItemForSend(
      {
        id: '1',
        category: 'backend-tech',
        title: 'Bun release',
        url: 'https://bun.sh',
        publishedAt: '2026-04-16T00:00:00.000Z',
        sourceName: 'Bun',
        sourceUrl: 'https://bun.sh',
        sourceType: 'official-page',
        authorityTier: 'official-release',
        sourceGroup: 'official',
        contentKind: 'release',
        summary: 'release',
        confidence: 0.9,
        sourceLabel: 'official',
        relevanceReason: 'release',
        technicalityScore: 3,
        crossVerified: false,
        messageKey: 'bun-release',
        contentFingerprint: 'same',
        isMaterialChange: false
      },
      {
        messageKey: 'bun-release',
        category: 'backend-tech',
        firstSeenAt: '2026-04-15T00:00:00.000Z',
        firstSentAt: '2026-04-15T00:00:00.000Z',
        lastSentAt: '2026-04-15T00:00:00.000Z',
        lastPublishedAt: '2026-04-15T00:00:00.000Z',
        lastContentFingerprint: 'same',
        lastContentChangeAt: '2026-04-15T00:00:00.000Z',
        lastTitle: 'Bun release',
        lastUrl: 'https://bun.sh',
        lastSourceName: 'Bun',
        lastDecision: 'send_new'
      },
      new Date('2026-04-16T00:00:00.000Z'),
      7
    );

    expect(decided.decisionReason).toBe('suppress_duplicate');

    const limited = limitCategoryItems(
      [
        {
          id: 'critical',
          category: 'general-security',
          title: 'critical',
          url: 'https://example.com/c',
          publishedAt: '2026-04-16T00:00:00.000Z',
          sourceName: 'Example',
          sourceUrl: 'https://example.com',
          sourceType: 'official-page',
          authorityTier: 'official-advisory',
          sourceGroup: 'official',
          contentKind: 'advisory',
          summary: 'critical',
          confidence: 0.9,
          sourceLabel: 'official',
          relevanceReason: 'critical',
          technicalityScore: 3,
          crossVerified: false,
          displaySeverity: 'critical'
        },
        {
          id: 'normal-a',
          category: 'general-security',
          title: 'normal-a',
          url: 'https://example.com/a',
          publishedAt: '2026-04-15T00:00:00.000Z',
          sourceName: 'Example',
          sourceUrl: 'https://example.com',
          sourceType: 'official-page',
          authorityTier: 'official-blog',
          sourceGroup: 'official',
          contentKind: 'advisory',
          summary: 'normal',
          confidence: 0.7,
          sourceLabel: 'official',
          relevanceReason: 'normal',
          technicalityScore: 3,
          crossVerified: false,
          displaySeverity: 'normal'
        },
        {
          id: 'normal-b',
          category: 'general-security',
          title: 'normal-b',
          url: 'https://example.com/b',
          publishedAt: '2026-04-14T00:00:00.000Z',
          sourceName: 'Example',
          sourceUrl: 'https://example.com',
          sourceType: 'official-page',
          authorityTier: 'official-blog',
          sourceGroup: 'official',
          contentKind: 'advisory',
          summary: 'normal',
          confidence: 0.7,
          sourceLabel: 'official',
          relevanceReason: 'normal',
          technicalityScore: 3,
          crossVerified: false,
          displaySeverity: 'normal'
        }
      ],
      config
    );

    expect(limited.displayedItems).toHaveLength(2);
    expect(limited.displayedItemIds.has('critical')).toBe(true);
  });

  it('finalizes category status and summarizes suppression counts', () => {
    expect(buildSuppressedSummary(2, 1, 3)).toContain('跨轮去重 2');

    const finalized = finalizeCategoryStatus(
      {
        category: 'ai-tech',
        title: 'ai',
        status: 'sent',
        itemCount: 1,
        sent: false,
        emptyDigest: false,
        sourcesChecked: [],
        displayedItems: [{ id: 'x' } as never]
      },
      true
    );

    expect(finalized.status).toBe('sent');
    expect(finalized.sent).toBe(true);
    expect(finalized.sentAt).toBeTruthy();
  });
});
