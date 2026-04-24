import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { normalizeIntelDatabaseOpenError } from '../../../src/runtime/storage/intel-db';
import { createIntelRepositories } from '../../../src/runtime/storage/intel.repositories';

describe('normalizeIntelDatabaseOpenError', () => {
  it('returns actionable better-sqlite3 ABI guidance and preserves the original cause', () => {
    const error = new Error(
      "The module 'better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 127."
    );

    const normalized = normalizeIntelDatabaseOpenError(error);

    expect(normalized.message).toContain('better-sqlite3');
    expect(normalized.message).toContain('NODE_MODULE_VERSION');
    expect(normalized.message).toContain('reinstall');
    expect(normalized.message).toContain('rebuild');
    expect(normalized.cause).toBe(error);
  });
});

describe('createIntelRepositories', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('bootstraps sqlite storage and persists raw events, signals, alerts, sources, digests, and deliveries', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'intel-db-'));
    tempDirs.push(dataDir);

    const repositories = createIntelRepositories({
      databaseFile: join(dataDir, 'intel.db')
    });

    const rawEventId = repositories.rawEvents.insert({
      jobId: 'job_001',
      query: 'axios vulnerability',
      sourceName: 'github',
      sourceType: 'official',
      title: 'axios security advisory',
      url: 'https://github.com/axios/axios/security/advisories/example',
      snippet: 'axios 发布安全公告',
      publishedAt: '2026-04-23T10:00:00.000Z',
      fetchedAt: '2026-04-23T10:01:00.000Z',
      contentHash: 'hash_001'
    });

    const signalId = repositories.signals.upsert({
      id: 'signal_001',
      dedupeKey: 'frontend_security:axios:security_advisory:2026-04-23',
      category: 'frontend_security',
      eventType: 'security_advisory',
      title: 'axios security advisory',
      summary: 'axios 发布安全公告',
      priority: 'P0',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-04-23T10:00:00.000Z',
      lastSeenAt: '2026-04-23T10:01:00.000Z'
    });

    const alertId = repositories.alerts.upsert({
      id: 'alert_001',
      signalId,
      alertLevel: 'P0',
      alertKind: 'formal',
      status: 'ready',
      createdAt: '2026-04-23T10:01:30.000Z',
      updatedAt: '2026-04-23T10:01:30.000Z'
    });

    const sourceIds = repositories.signalSources.insertMany([
      {
        id: 'signal_source_001',
        signalId,
        contentHash: 'hash_001',
        sourceName: 'github',
        sourceType: 'official',
        title: 'axios security advisory',
        url: 'https://github.com/axios/axios/security/advisories/example',
        snippet: 'axios 发布安全公告',
        publishedAt: '2026-04-23T10:00:00.000Z',
        fetchedAt: '2026-04-23T10:01:00.000Z',
        createdAt: '2026-04-23T10:01:30.000Z'
      }
    ]);

    const deliveryId = repositories.deliveries.insert({
      id: 'delivery_001',
      signalId,
      alertId,
      channelType: 'lark',
      channelTarget: 'security_alert',
      deliveryKind: 'alert',
      deliveryStatus: 'pending',
      retryCount: 0,
      statusVersion: 1,
      createdAt: '2026-04-23T10:02:00.000Z',
      updatedAt: '2026-04-23T10:02:00.000Z',
      nextRetryAt: '2026-04-23T10:12:00.000Z',
      expiresAt: '2026-04-24T10:02:00.000Z'
    });

    const digestId = repositories.dailyDigests.insert({
      id: 'digest_2026-04-23_frontend',
      digestDate: '2026-04-23',
      groupKey: 'frontend',
      title: 'Frontend Daily Digest',
      summary: 'axios 安全公告',
      contentMarkdown: '- axios security advisory',
      windowStart: '2026-04-23T00:00:00.000Z',
      windowEnd: '2026-04-24T00:00:00.000Z',
      createdAt: '2026-04-23T23:00:00.000Z',
      updatedAt: '2026-04-23T23:00:00.000Z'
    });

    repositories.dailyDigests.replaceSignalMembership(digestId, [
      {
        digestId,
        signalId,
        position: 0,
        createdAt: '2026-04-23T23:00:00.000Z'
      }
    ]);

    expect(rawEventId).toBeGreaterThan(0);
    expect(signalId).toBe('signal_001');
    expect(alertId).toBe('alert_001');
    expect(sourceIds).toEqual(['signal_source_001']);
    expect(deliveryId).toBe('delivery_001');
    expect(digestId).toBe('digest_2026-04-23_frontend');
    expect(repositories.signalSources.listBySignal(signalId)).toEqual([
      expect.objectContaining({
        id: 'signal_source_001',
        signalId,
        contentHash: 'hash_001'
      })
    ]);
    expect(repositories.signalSources.listBySignalIds([signalId])).toEqual([
      expect.objectContaining({
        id: 'signal_source_001',
        signalId,
        contentHash: 'hash_001'
      })
    ]);
    expect(repositories.dailyDigests.listSignalMembership(digestId)).toEqual([
      expect.objectContaining({
        digestId,
        signalId,
        position: 0
      })
    ]);
    expect(repositories.deliveries.listPending()).toEqual([
      expect.objectContaining({
        id: 'delivery_001',
        signalId,
        alertId,
        statusVersion: 1,
        nextRetryAt: '2026-04-23T10:12:00.000Z',
        expiresAt: '2026-04-24T10:02:00.000Z'
      })
    ]);
  });

  it('collects digest candidates by window and persists delivery status transitions', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'intel-db-'));
    tempDirs.push(dataDir);

    const repositories = createIntelRepositories({
      databaseFile: join(dataDir, 'intel.db')
    });

    repositories.signals.upsert({
      id: 'signal_001',
      dedupeKey: 'frontend_security:axios:security_advisory:2026-04-23',
      category: 'frontend_security',
      eventType: 'security_advisory',
      title: 'axios security advisory',
      summary: 'axios 发布安全公告',
      priority: 'P0',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-04-23T10:00:00.000Z',
      lastSeenAt: '2026-04-23T10:01:00.000Z'
    });
    repositories.signals.upsert({
      id: 'signal_002',
      dedupeKey: 'ai_release:gpt-release:announcement:2026-04-23',
      category: 'ai_release',
      eventType: 'release_announcement',
      title: 'new model release',
      summary: '新的模型版本发布',
      priority: 'P1',
      confidence: 'medium',
      status: 'pending',
      firstSeenAt: '2026-04-23T11:00:00.000Z',
      lastSeenAt: '2026-04-23T11:30:00.000Z'
    });
    repositories.signals.upsert({
      id: 'signal_003',
      dedupeKey: 'platform_infra:build-cache:incident:2026-04-22',
      category: 'platform_infra',
      eventType: 'incident',
      title: 'build cache incident',
      summary: '构建缓存故障',
      priority: 'P1',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-04-22T08:00:00.000Z',
      lastSeenAt: '2026-04-22T08:30:00.000Z'
    });

    repositories.deliveries.insert({
      id: 'delivery_sent',
      signalId: 'signal_001',
      channelType: 'lark',
      channelTarget: 'security_alert',
      deliveryKind: 'alert',
      deliveryStatus: 'pending',
      retryCount: 1,
      statusVersion: 1,
      createdAt: '2026-04-23T10:02:00.000Z',
      updatedAt: '2026-04-23T10:02:00.000Z'
    });
    repositories.deliveries.insert({
      id: 'delivery_failed',
      signalId: 'signal_002',
      channelType: 'lark',
      channelTarget: 'digest_frontend',
      deliveryKind: 'digest',
      deliveryStatus: 'pending',
      retryCount: 0,
      statusVersion: 1,
      createdAt: '2026-04-23T11:35:00.000Z',
      updatedAt: '2026-04-23T11:35:00.000Z'
    });
    repositories.deliveries.insert({
      id: 'delivery_closed',
      signalId: 'signal_002',
      channelType: 'lark',
      channelTarget: 'digest_management',
      deliveryKind: 'digest',
      deliveryStatus: 'pending',
      retryCount: 2,
      statusVersion: 1,
      createdAt: '2026-04-23T11:36:00.000Z',
      updatedAt: '2026-04-23T11:36:00.000Z'
    });

    expect(
      repositories.signals.listByWindow({
        windowStart: '2026-04-23T00:00:00.000Z',
        windowEnd: '2026-04-24T00:00:00.000Z'
      })
    ).toEqual([expect.objectContaining({ id: 'signal_001' }), expect.objectContaining({ id: 'signal_002' })]);

    repositories.deliveries.markSent({
      id: 'delivery_sent',
      now: '2026-04-23T10:05:00.000Z'
    });
    repositories.deliveries.markFailed({
      id: 'delivery_failed',
      now: '2026-04-23T11:40:00.000Z',
      failureReason: 'Webhook timeout',
      nextRetryAt: '2026-04-23T12:10:00.000Z'
    });
    repositories.deliveries.markClosed({
      id: 'delivery_closed',
      now: '2026-04-23T12:00:00.000Z',
      failureReason: 'Digest window expired'
    });

    expect(repositories.deliveries.listPending()).toEqual([
      expect.objectContaining({
        id: 'delivery_failed',
        deliveryStatus: 'failed',
        retryCount: 1,
        failureReason: 'Webhook timeout',
        nextRetryAt: '2026-04-23T12:10:00.000Z',
        lastAttemptAt: '2026-04-23T11:40:00.000Z'
      })
    ]);
    expect(repositories.deliveries.getById('delivery_sent')).toEqual(
      expect.objectContaining({
        id: 'delivery_sent',
        deliveryStatus: 'sent',
        lastAttemptAt: '2026-04-23T10:05:00.000Z'
      })
    );
    expect(repositories.deliveries.getById('delivery_closed')).toEqual(
      expect.objectContaining({
        id: 'delivery_closed',
        deliveryStatus: 'closed',
        failureReason: 'Digest window expired',
        closedAt: '2026-04-23T12:00:00.000Z'
      })
    );
  });

  it('returns the existing raw event id when the same content hash is inserted twice', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'intel-db-'));
    tempDirs.push(dataDir);

    const repositories = createIntelRepositories({
      databaseFile: join(dataDir, 'intel.db')
    });
    const rawEventInput = {
      jobId: 'job_001',
      query: 'axios vulnerability',
      sourceName: 'github',
      sourceType: 'official',
      title: 'axios security advisory',
      url: 'https://github.com/axios/axios/security/advisories/example',
      snippet: 'axios 发布安全公告',
      publishedAt: '2026-04-23T10:00:00.000Z',
      fetchedAt: '2026-04-23T10:01:00.000Z',
      contentHash: 'hash_001'
    };

    const firstId = repositories.rawEvents.insert(rawEventInput);
    const secondId = repositories.rawEvents.insert({ ...rawEventInput, snippet: 'updated snippet' });

    expect(secondId).toBe(firstId);
  });
});
