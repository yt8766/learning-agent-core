import Database from 'better-sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { dedupeAndMergeNode } from '../../../src/flows/intel/nodes/dedupe-and-merge';
import {
  resolveIntelContentHash,
  resolveIntelSignalSourceId
} from '../../../src/flows/intel/nodes/intel-evidence-helpers';
import { normalizeSignalsNode } from '../../../src/flows/intel/nodes/normalize-signals';
import { persistRawEventsNode } from '../../../src/flows/intel/nodes/persist-raw-events';
import { createIntelRepositories } from '../../../src/runtime/storage/intel.repositories';

describe('normalize signals', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('persists raw events and normalizes mocked search results into signal candidates', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'intel-normalize-'));
    tempDirs.push(dataDir);

    const repositories = createIntelRepositories({
      databaseFile: join(dataDir, 'intel.db')
    });

    const rawResults = [
      {
        taskId: 'job_001:frontend_security:0',
        topicKey: 'frontend_security',
        query: 'axios vulnerability',
        priorityDefault: 'P1' as const,
        sourceName: 'github',
        sourceType: 'official' as const,
        title: 'Axios security advisory',
        url: 'https://github.com/axios/axios/security/advisories/1',
        snippet: 'Axios 发布了安全公告',
        publishedAt: '2026-04-23T10:00:00.000Z',
        fetchedAt: '2026-04-23T10:01:00.000Z'
      }
    ];

    const persistedState = persistRawEventsNode({
      jobId: 'job_001',
      rawResults,
      repositories
    });

    const database = new Database(join(dataDir, 'intel.db'));
    const persistedCount = database.prepare('SELECT COUNT(*) AS count FROM raw_events').get() as { count: number };
    database.close();

    const normalizedState = normalizeSignalsNode({
      jobId: 'job_001',
      rawResults
    });

    expect(persistedState.persistedRawEventIds).toHaveLength(1);
    expect(persistedCount.count).toBe(1);
    expect(normalizedState.normalizedSignals).toEqual([
      {
        id: 'job_001:frontend_security:0',
        dedupeKey: 'frontend_security:axios:vulnerability:2026-04-23',
        category: 'frontend_security',
        eventType: 'security_advisory',
        title: 'Axios security advisory',
        summary: 'Axios 发布了安全公告',
        priority: 'P1',
        confidence: 'low',
        status: 'pending',
        firstSeenAt: '2026-04-23T10:00:00.000Z',
        lastSeenAt: '2026-04-23T10:01:00.000Z'
      }
    ]);
  });

  it('resolves deterministic evidence ids for raw results and signal sources', () => {
    expect(
      resolveIntelContentHash({
        taskId: 'task',
        url: 'https://x.test/a',
        publishedAt: '2026-04-24T00:00:00.000Z',
        title: 'Title'
      })
    ).toMatch(/^[a-f0-9]{40}$/);
    expect(resolveIntelSignalSourceId('signal_1', 'hash_1')).toBe('signal_source_signal_1_hash_1');
  });

  it('maps same-run duplicate incoming signals to one final merged signal id', () => {
    const first = {
      id: 'incoming_1',
      dedupeKey: 'frontend_security:axios:vulnerability:2026-04-24',
      category: 'frontend_security',
      eventType: 'security_advisory',
      title: 'Axios security advisory',
      summary: 'Axios advisory from official source',
      priority: 'P1',
      confidence: 'low',
      status: 'pending',
      firstSeenAt: '2026-04-24T00:00:00.000Z',
      lastSeenAt: '2026-04-24T00:01:00.000Z'
    } as const;
    const second = {
      ...first,
      id: 'incoming_2',
      summary: 'Axios advisory from community source',
      lastSeenAt: '2026-04-24T00:02:00.000Z'
    } as const;

    const state = dedupeAndMergeNode({
      existingSignals: [],
      incomingSignals: [first, second]
    });

    expect(state.mergedSignals).toHaveLength(1);
    const finalSignal = state.mergedSignals[0];
    expect(finalSignal).toBeDefined();
    expect(state.signalMergeMap).toEqual({
      [first.id]: finalSignal?.id,
      [second.id]: finalSignal?.id
    });
  });
});
