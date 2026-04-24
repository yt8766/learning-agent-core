import { describe, expect, it, vi } from 'vitest';

import type { IntelSignal, IntelSignalSource } from '@agent/core';

import { DigestGraphStateSchema } from '../../../src/flows/intel/schemas/digest-graph-state.schema';
import { executeDigestIntelRun } from '../../../src/services/digest-intel.service';

describe('executeDigestIntelRun', () => {
  it('collects same-day signals, ranks highlights, renders a digest, persists it, and queues digest deliveries', async () => {
    const listedSignals: IntelSignal[] = [
      {
        id: 'signal_critical',
        dedupeKey: 'frontend_security:axios:zero_day:2026-04-24',
        category: 'frontend_security',
        eventType: 'security_advisory',
        title: 'Axios zero-day advisory',
        summary: 'Axios published a confirmed zero-day security advisory.',
        priority: 'P0',
        confidence: 'high',
        status: 'confirmed',
        firstSeenAt: '2026-04-24T09:00:00.000Z',
        lastSeenAt: '2026-04-24T09:30:00.000Z'
      },
      {
        id: 'signal_release',
        dedupeKey: 'ai_release:gpt:update:2026-04-24',
        category: 'ai_release',
        eventType: 'release',
        title: 'Model release rollout',
        summary: 'A major model release rollout was announced.',
        priority: 'P1',
        confidence: 'medium',
        status: 'pending',
        firstSeenAt: '2026-04-24T12:00:00.000Z',
        lastSeenAt: '2026-04-24T12:15:00.000Z'
      },
      {
        id: 'signal_minor',
        dedupeKey: 'frontend_security:deps:update:2026-04-24',
        category: 'frontend_security',
        eventType: 'maintenance',
        title: 'Dependency maintenance note',
        summary: 'Routine maintenance update with no confirmed exploit.',
        priority: 'P2',
        confidence: 'low',
        status: 'pending',
        firstSeenAt: '2026-04-24T15:00:00.000Z',
        lastSeenAt: '2026-04-24T15:10:00.000Z'
      },
      {
        id: 'signal_previous_day',
        dedupeKey: 'platform_infra:incident:2026-04-23',
        category: 'platform_infra',
        eventType: 'incident',
        title: 'Yesterday infrastructure incident',
        summary: 'This signal should be filtered out because it is from the previous day.',
        priority: 'P0',
        confidence: 'high',
        status: 'confirmed',
        firstSeenAt: '2026-04-23T21:00:00.000Z',
        lastSeenAt: '2026-04-23T21:30:00.000Z'
      }
    ];
    const listSignalsInWindow = vi.fn(async (): Promise<IntelSignal[]> => listedSignals);
    const listBySignalIds = vi.fn(
      async (): Promise<IntelSignalSource[]> => [
        {
          id: 'source_critical_official',
          signalId: 'signal_critical',
          contentHash: 'hash_critical_official',
          sourceName: 'github',
          sourceType: 'official',
          title: 'Axios zero-day advisory',
          url: 'https://github.com/axios/axios/security/advisories/zero-day',
          snippet: 'Official Axios advisory',
          publishedAt: '2026-04-24T09:00:00.000Z',
          fetchedAt: '2026-04-24T09:30:00.000Z',
          createdAt: '2026-04-24T09:31:00.000Z'
        },
        {
          id: 'source_critical_community',
          signalId: 'signal_critical',
          contentHash: 'hash_critical_community',
          sourceName: 'hackernews',
          sourceType: 'community',
          title: 'Axios zero-day discussion',
          url: 'https://news.ycombinator.com/item?id=critical',
          snippet: 'Community cross-check',
          publishedAt: '2026-04-24T09:10:00.000Z',
          fetchedAt: '2026-04-24T09:35:00.000Z',
          createdAt: '2026-04-24T09:36:00.000Z'
        },
        {
          id: 'source_release_official',
          signalId: 'signal_release',
          contentHash: 'hash_release_official',
          sourceName: 'openai',
          sourceType: 'official',
          title: 'Model release rollout',
          url: 'https://openai.com/index/model-release',
          snippet: 'Official release notes',
          publishedAt: '2026-04-24T12:00:00.000Z',
          fetchedAt: '2026-04-24T12:15:00.000Z',
          createdAt: '2026-04-24T12:16:00.000Z'
        }
      ]
    );
    const createDailyDigest = vi.fn(async () => 'digest_2026-04-24');
    const linkSignals = vi.fn(async () => undefined);
    const insertDelivery = vi.fn((input: { id: string }) => input.id);

    const result = await executeDigestIntelRun({
      jobId: 'job_digest_001',
      startedAt: '2026-04-24T20:00:00.000Z',
      routes: {
        defaults: {
          suppressDuplicateHours: 24
        },
        rules: [
          {
            id: 'digest-daily-primary',
            enabled: true,
            when: {
              categoryIn: ['frontend_security', 'ai_release'],
              priorityIn: ['P0', 'P1', 'P2'],
              statusIn: [],
              deliveryKindIn: ['digest']
            },
            sendTo: ['digest_frontend'],
            template: 'digest_daily_markdown'
          },
          {
            id: 'alert-only-security',
            enabled: true,
            when: {
              categoryIn: ['frontend_security'],
              priorityIn: ['P0'],
              statusIn: ['confirmed'],
              deliveryKindIn: ['alert']
            },
            sendTo: ['security_alert'],
            template: 'security_alert_full'
          }
        ]
      },
      repositories: {
        signals: {
          listInWindow: listSignalsInWindow
        },
        digests: {
          createDailyDigest,
          linkSignals
        },
        deliveries: {
          insert: insertDelivery
        },
        signalSources: {
          listBySignalIds
        }
      } as never
    });

    const parsed = DigestGraphStateSchema.parse(result);

    expect(listSignalsInWindow).toHaveBeenCalledWith({
      startAt: '2026-04-24T00:00:00.000Z',
      endAt: '2026-04-25T00:00:00.000Z'
    });
    expect(parsed.collectedSignals.map(signal => signal.id)).toEqual([
      'signal_critical',
      'signal_release',
      'signal_minor'
    ]);
    expect(parsed.groupedSignals).toEqual([
      expect.objectContaining({
        category: 'frontend_security',
        signalCount: 2,
        highlightSignalIds: ['signal_critical', 'signal_minor']
      }),
      expect.objectContaining({
        category: 'ai_release',
        signalCount: 1,
        highlightSignalIds: ['signal_release']
      })
    ]);
    expect(parsed.highlights.map(highlight => highlight.signal.id)).toEqual([
      'signal_critical',
      'signal_release',
      'signal_minor'
    ]);
    expect(parsed.renderedDigest).toBeDefined();
    expect(parsed.renderedDigest?.title).toBe('Intel Daily Digest - 2026-04-24');
    expect(parsed.renderedDigest?.markdown).toContain('Axios zero-day advisory');
    expect(parsed.renderedDigest?.markdown).toContain('frontend_security (2)');
    expect(parsed.renderedDigest?.markdown).toContain('ai_release (1)');
    expect(parsed.renderedDigest?.markdown).toContain('Evidence: 2 sources (1 official / 1 community)');
    expect(parsed.renderedDigest?.markdown).toContain(
      'github (official): https://github.com/axios/axios/security/advisories/zero-day'
    );
    expect(parsed.renderedDigest?.markdown).toContain(
      'hackernews (community): https://news.ycombinator.com/item?id=critical'
    );
    expect(parsed.renderedDigest?.markdown).toContain('Evidence: 1 source (1 official / 0 community)');
    expect(listBySignalIds).toHaveBeenCalledWith(['signal_critical', 'signal_release', 'signal_minor']);

    expect(createDailyDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'digest_2026-04-24',
        digestDate: '2026-04-24',
        title: 'Intel Daily Digest - 2026-04-24',
        signalCount: 3,
        highlightCount: 3,
        content: expect.stringContaining('Highlights')
      })
    );
    expect(linkSignals).toHaveBeenCalledWith('digest_2026-04-24', [
      'signal_critical',
      'signal_release',
      'signal_minor'
    ]);

    expect(parsed.matchedRoutes).toEqual([
      {
        signalId: 'signal_critical',
        routeIds: ['digest-daily-primary'],
        channelTargets: ['digest_frontend']
      },
      {
        signalId: 'signal_release',
        routeIds: ['digest-daily-primary'],
        channelTargets: ['digest_frontend']
      },
      {
        signalId: 'signal_minor',
        routeIds: ['digest-daily-primary'],
        channelTargets: ['digest_frontend']
      }
    ]);
    expect(parsed.queuedDeliveries).toEqual([
      expect.objectContaining({
        id: 'delivery_digest_2026-04-24_digest_frontend',
        digestId: 'digest_2026-04-24',
        signalId: 'signal_critical',
        channelTarget: 'digest_frontend',
        deliveryKind: 'digest',
        deliveryStatus: 'pending'
      })
    ]);
    expect(insertDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'delivery_digest_2026-04-24_digest_frontend',
        signalId: 'signal_critical',
        channelTarget: 'digest_frontend',
        deliveryKind: 'digest',
        deliveryStatus: 'pending'
      })
    );
  });
});
