import { describe, expect, it } from 'vitest';

import {
  computeCronForCategory,
  nextBriefingScheduleState,
  resolveBriefingCategoryConfig,
  resolveBriefingLookbackDays,
  scheduleForCategory,
  type BriefingSettings
} from '../../../src/runtime/briefing/briefing-schedule';

const baseSettings: BriefingSettings = {
  enabled: true,
  schedule: 'daily 11:00',
  sendEmptyDigest: true,
  maxItemsPerCategory: 3,
  duplicateWindowDays: 7,
  maxNonCriticalItemsPerCategory: 10,
  maxCriticalItemsPerCategory: 20,
  maxTotalItemsPerCategory: 30,
  sendOnlyDelta: true,
  resendOnlyOnMaterialChange: true,
  larkDigestMode: 'dual',
  sourcePolicy: 'tiered-authority',
  webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
  translationEnabled: false,
  translationModel: 'glm-4.7-flashx',
  aiLookbackDays: 7,
  frontendLookbackDays: 14,
  securityLookbackDays: 21
};

describe('runtime tech briefing schedule helpers', () => {
  it('resolves category config and lookback days from settings', () => {
    expect(resolveBriefingCategoryConfig(baseSettings, 'frontend-security').baseIntervalHours).toBe(4);
    expect(resolveBriefingLookbackDays(baseSettings, 'frontend-tech')).toBe(14);
    expect(resolveBriefingLookbackDays(baseSettings, 'general-security')).toBe(21);
  });

  it('tightens interval on hot streaks and relaxes on repeated empty runs', () => {
    const hotState = nextBriefingScheduleState({
      settings: baseSettings,
      category: 'frontend-security',
      previous: {
        enabled: true,
        baseIntervalHours: 4,
        currentIntervalHours: 4,
        allowedIntervalHours: [2, 4, 8],
        lookbackDays: 3,
        consecutiveHotRuns: 1,
        consecutiveEmptyRuns: 0,
        recentRunStats: [],
        lastRunAt: '2026-04-16T00:00:00.000Z',
        nextRunAt: '2026-04-16T04:00:00.000Z'
      },
      result: {
        category: 'frontend-security',
        title: 'security',
        status: 'sent',
        itemCount: 1,
        sent: false,
        emptyDigest: false,
        sourcesChecked: [],
        newCount: 1,
        updateCount: 0,
        crossRunSuppressedCount: 0,
        sameRunMergedCount: 0,
        overflowCollapsedCount: 0,
        displayedItemCount: 1,
        displayedItems: [
          {
            id: 'item-1',
            category: 'frontend-security',
            title: 'critical advisory',
            cleanTitle: 'critical advisory',
            url: 'https://example.com',
            publishedAt: '2026-04-16T01:00:00.000Z',
            sourceName: 'Example',
            sourceUrl: 'https://example.com',
            sourceType: 'official-page',
            authorityTier: 'official-advisory',
            sourceGroup: 'official',
            contentKind: 'advisory',
            summary: 'critical',
            confidence: 0.9,
            sourceLabel: 'Example',
            relevanceReason: 'critical',
            technicalityScore: 3,
            crossVerified: false,
            displaySeverity: 'critical'
          }
        ],
        overflowTitles: [],
        auditRecords: []
      },
      now: new Date('2026-04-16T02:00:00.000Z'),
      reason: 'scheduled'
    });

    expect(hotState.currentIntervalHours).toBe(2);
    expect(hotState.lastAdaptiveReason).toBe('hot_streak');

    const cooldownState = nextBriefingScheduleState({
      settings: baseSettings,
      category: 'frontend-security',
      previous: {
        ...hotState,
        currentIntervalHours: 2,
        consecutiveHotRuns: 0,
        consecutiveEmptyRuns: 5
      },
      result: {
        category: 'frontend-security',
        title: 'security',
        status: 'empty',
        itemCount: 0,
        sent: false,
        emptyDigest: true,
        sourcesChecked: [],
        newCount: 0,
        updateCount: 0,
        crossRunSuppressedCount: 0,
        sameRunMergedCount: 0,
        overflowCollapsedCount: 0,
        displayedItemCount: 0,
        displayedItems: [],
        overflowTitles: [],
        auditRecords: []
      },
      now: new Date('2026-04-17T02:00:00.000Z'),
      reason: 'scheduled'
    });

    expect(cooldownState.currentIntervalHours).toBe(4);
    expect(cooldownState.lastAdaptiveReason).toBe('cooldown');
  });

  it('derives category schedule strings and crons', () => {
    expect(scheduleForCategory('frontend-security', { baseIntervalHours: 4 })).toBe('daily every 4 hours');
    expect(computeCronForCategory('frontend-security', 4)).toBe('0 */4 * * *');
    expect(computeCronForCategory('backend-tech', 24)).toBe('0 11 * * *');
  });
});
