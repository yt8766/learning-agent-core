import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createIntelGraph } from '../../src/graphs/intel/intel.graph';
import { createIntelRepositories } from '../../src/runtime/storage/intel.repositories';

describe('createIntelGraph', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('runs the patrol intel pipeline through the graph entry and queues matched deliveries', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'intel-graph-'));
    tempDirs.push(dataDir);

    const repositories = createIntelRepositories({
      databaseFile: join(dataDir, 'intel.db')
    });

    const graph = createIntelGraph().compile();
    const result = await graph.invoke({
      mode: 'patrol',
      jobId: 'job_graph_001',
      startedAt: '2026-04-24T11:00:00.000Z',
      sources: {
        defaults: { recencyHours: 24 },
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
            sendTo: ['security_alert'],
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
                publishedAt: '2026-04-24T10:59:00.000Z',
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
    expect(result.queuedDeliveries).toEqual([
      expect.objectContaining({
        channelTarget: 'security_alert'
      })
    ]);
  });

  it('runs the digest pipeline through the graph entry and persists daily digests', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'intel-graph-digest-'));
    tempDirs.push(dataDir);

    const repositories = createIntelRepositories({
      databaseFile: join(dataDir, 'intel.db')
    });

    repositories.signals.upsert({
      id: 'signal_digest_001',
      dedupeKey: 'frontend_tech:react:release:2026-04-24',
      category: 'frontend_tech',
      eventType: 'release',
      title: 'React 发布新版本',
      summary: 'React 发布了新的稳定版本，适合纳入日报重点。',
      priority: 'P1',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-04-24T08:00:00.000Z',
      lastSeenAt: '2026-04-24T08:05:00.000Z'
    });
    repositories.signals.upsert({
      id: 'signal_digest_002',
      dedupeKey: 'ai_release:openai:model:2026-04-24',
      category: 'ai_release',
      eventType: 'model_release',
      title: 'OpenAI 发布新模型',
      summary: 'OpenAI 发布新模型，适合纳入 AI 日报。',
      priority: 'P0',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-04-24T09:00:00.000Z',
      lastSeenAt: '2026-04-24T09:05:00.000Z'
    });

    const graph = createIntelGraph().compile();
    const result = await graph.invoke({
      mode: 'digest',
      jobId: 'job_digest_graph_001',
      startedAt: '2026-04-24T21:00:00.000Z',
      digestDate: '2026-04-24',
      routes: {
        defaults: { suppressDuplicateHours: 24 },
        rules: [
          {
            id: 'digest-frontend',
            enabled: true,
            when: {
              categoryIn: ['frontend_tech'],
              priorityIn: [],
              statusIn: [],
              deliveryKindIn: ['digest']
            },
            sendTo: ['digest_frontend'],
            template: 'daily_digest'
          },
          {
            id: 'digest-management',
            enabled: true,
            when: {
              categoryIn: ['ai_release'],
              priorityIn: [],
              statusIn: [],
              deliveryKindIn: ['digest']
            },
            sendTo: ['digest_management'],
            template: 'daily_digest'
          }
        ]
      },
      repositories
    });

    expect(result.persistedDigestIds).toEqual(['digest_2026-04-24']);
    expect(result.renderedDigests).toEqual([
      expect.objectContaining({
        category: 'daily',
        digestDate: '2026-04-24'
      })
    ]);
    expect(result.queuedDeliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deliveryKind: 'digest',
          channelTarget: 'digest_frontend'
        }),
        expect.objectContaining({
          deliveryKind: 'digest',
          channelTarget: 'digest_management'
        })
      ])
    );
  });
});
