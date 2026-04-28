import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { attachSignalSources } from '../../../src/flows/intel/nodes/attach-signal-sources';
import { createIntelRepositories } from '../../../src/runtime/storage/intel.repositories';
import { executePatrolIntelRun } from '../../../src/runtime/execution/patrol-intel-run';

describe('executePatrolIntelRun (canonical path)', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('runs the patrol pipeline from search tasks through queued deliveries', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'intel-patrol-run-'));
    tempDirs.push(dataDir);

    const repositories = createIntelRepositories({
      databaseFile: join(dataDir, 'intel.db')
    });

    const result = await executePatrolIntelRun({
      jobId: 'job_001',
      startedAt: '2026-04-24T09:00:00.000Z',
      sources: {
        defaults: { recencyHours: 48 },
        topics: [
          {
            key: 'frontend_security',
            enabled: true,
            mode: 'patrol',
            priorityDefault: 'P1',
            queries: ['axios vulnerability']
          }
        ]
      },
      routes: {
        defaults: { suppressDuplicateHours: 24 },
        rules: [
          {
            id: 'frontend-security-critical',
            enabled: true,
            when: {
              categoryIn: ['frontend_security'],
              priorityIn: ['P0'],
              statusIn: ['confirmed'],
              deliveryKindIn: ['alert']
            },
            sendTo: ['security_alert', 'frontend_daily'],
            template: 'security_alert_full'
          }
        ]
      },
      repositories,
      mcpClientManager: {
        hasCapability: () => true,
        invokeTool: async () => ({
          ok: true,
          rawOutput: {
            results: [
              {
                title: 'Axios security advisory',
                url: 'https://github.com/axios/axios/security/advisories/1',
                summary: 'Axios 发布了安全公告',
                sourceName: 'github',
                sourceType: 'official'
              }
            ]
          }
        })
      }
    });

    expect(result.generatedAlerts).toEqual([
      expect.objectContaining({
        alertKind: 'formal',
        alertLevel: 'P0'
      })
    ]);
    expect(result.queuedDeliveries.map(delivery => delivery.channelTarget)).toEqual([
      'security_alert',
      'frontend_daily'
    ]);
  });

  it('attaches official and community sources to the final merged signal', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'intel-patrol-run-'));
    tempDirs.push(dataDir);

    const repositories = createIntelRepositories({
      databaseFile: join(dataDir, 'intel.db')
    });

    const result = await executePatrolIntelRun({
      jobId: 'job_002',
      startedAt: '2026-04-24T10:00:00.000Z',
      sources: {
        defaults: { recencyHours: 48 },
        topics: [
          {
            key: 'frontend_security',
            enabled: true,
            mode: 'patrol',
            priorityDefault: 'P1',
            queries: ['axios vulnerability']
          }
        ]
      },
      routes: {
        defaults: { suppressDuplicateHours: 24 },
        rules: []
      },
      repositories,
      mcpClientManager: {
        hasCapability: () => true,
        invokeTool: async () => ({
          ok: true,
          rawOutput: {
            results: [
              {
                title: 'Axios security advisory',
                url: 'https://github.com/axios/axios/security/advisories/1',
                summary: 'Axios 发布了安全公告',
                publishedAt: '2026-04-24T08:58:00.000Z',
                sourceName: 'github',
                sourceType: 'official'
              },
              {
                title: 'Axios security advisory discussion',
                url: 'https://news.ycombinator.com/item?id=axios-advisory',
                summary: 'Community discussion mentions the same Axios vulnerability advisory',
                publishedAt: '2026-04-24T08:59:00.000Z',
                sourceName: 'hackernews',
                sourceType: 'community'
              }
            ]
          }
        })
      }
    });

    expect(result.scoredSignals).toHaveLength(1);

    const finalSignalId = result.scoredSignals[0]?.id;
    expect(finalSignalId).toBeTruthy();

    const sources = repositories.signalSources.listBySignal(finalSignalId ?? '');
    expect(sources).toHaveLength(2);
    expect(sources.map(source => source.signalId)).toEqual([finalSignalId, finalSignalId]);
    expect(sources.map(source => source.sourceType).sort()).toEqual(['community', 'official']);
  });

  it('reuses the existing signal when a later run produces the same dedupe key', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'intel-patrol-run-'));
    tempDirs.push(dataDir);

    const repositories = createIntelRepositories({
      databaseFile: join(dataDir, 'intel.db')
    });

    const baseInput = {
      sources: {
        defaults: { recencyHours: 48 },
        topics: [
          {
            key: 'frontend_security',
            enabled: true,
            mode: 'patrol' as const,
            priorityDefault: 'P1' as const,
            queries: ['axios vulnerability']
          }
        ]
      },
      routes: {
        defaults: { suppressDuplicateHours: 24 },
        rules: []
      },
      repositories,
      mcpClientManager: {
        hasCapability: () => true,
        invokeTool: async () => ({
          ok: true,
          rawOutput: {
            results: [
              {
                title: 'Axios security advisory',
                url: 'https://github.com/axios/axios/security/advisories/1',
                summary: 'Axios 发布了安全公告',
                publishedAt: '2026-04-24T08:58:00.000Z',
                sourceName: 'github',
                sourceType: 'official'
              }
            ]
          }
        })
      }
    };

    const firstRun = await executePatrolIntelRun({
      ...baseInput,
      jobId: 'job_003',
      startedAt: '2026-04-24T11:00:00.000Z'
    });
    const secondRun = await executePatrolIntelRun({
      ...baseInput,
      jobId: 'job_004',
      startedAt: '2026-04-24T11:05:00.000Z'
    });

    const firstSignalId = firstRun.scoredSignals[0]?.id;
    const secondSignalId = secondRun.scoredSignals[0]?.id;

    expect(firstSignalId).toBeTruthy();
    expect(secondSignalId).toBe(firstSignalId);
    expect(repositories.signalSources.listBySignal(firstSignalId ?? '')).toHaveLength(1);
  });

  it('fails when a normalized signal is missing a final signal mapping', () => {
    expect(() =>
      attachSignalSources({
        rawResults: [
          {
            taskId: 'task_1',
            topicKey: 'frontend_security',
            query: 'axios vulnerability',
            priorityDefault: 'P1',
            sourceName: 'github',
            sourceType: 'official',
            title: 'Axios security advisory',
            url: 'https://github.com/axios/axios/security/advisories/1',
            snippet: 'Axios 发布了安全公告',
            publishedAt: '2026-04-24T08:58:00.000Z',
            fetchedAt: '2026-04-24T10:00:00.000Z',
            contentHash: 'hash_1'
          }
        ],
        normalizedSignals: [
          {
            id: 'task_1',
            dedupeKey: 'frontend_security:axios:vulnerability:2026-04-24',
            category: 'frontend_security',
            eventType: 'security_advisory',
            title: 'Axios security advisory',
            summary: 'Axios 发布了安全公告',
            priority: 'P1',
            confidence: 'low',
            status: 'pending',
            firstSeenAt: '2026-04-24T08:58:00.000Z',
            lastSeenAt: '2026-04-24T10:00:00.000Z'
          }
        ],
        signalMergeMap: {},
        createdAt: '2026-04-24T10:00:00.000Z'
      })
    ).toThrow(/missing final signal mapping/i);
  });
});
