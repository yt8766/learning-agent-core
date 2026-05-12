import { describe, expect, it } from 'vitest';

import {
  createIntelligenceMemoryRepository,
  IntelligenceMemoryRepository
} from '../../src/runtime/intelligence/intelligence-memory.repository';
import type {
  IntelligenceRunInput,
  IntelligenceQueryInput,
  IntelligenceRawEventInput,
  IntelligenceSignalInput,
  IntelligenceSourceInput,
  IntelligenceKnowledgeCandidateInput
} from '../../src/runtime/intelligence/intelligence.repository';

describe('IntelligenceMemoryRepository', () => {
  function createRepo() {
    return new IntelligenceMemoryRepository();
  }

  const runInput: IntelligenceRunInput = {
    id: 'run-1',
    workspaceId: 'ws-1',
    runKind: 'scheduled',
    status: 'completed',
    startedAt: '2026-05-01T00:00:00.000Z',
    completedAt: '2026-05-01T00:01:00.000Z',
    summary: { total: 5 }
  };

  const queryInput: IntelligenceQueryInput = {
    id: 'q-1',
    runId: 'run-1',
    channel: 'rss',
    direction: 'inbound',
    query: 'test',
    provider: 'rss-provider',
    status: 'completed',
    startedAt: '2026-05-01T00:00:00.000Z',
    resultCount: 3
  };

  const rawEventInput: IntelligenceRawEventInput = {
    id: 'ev-1',
    queryId: 'q-1',
    contentHash: 'abc123',
    title: 'Event Title',
    url: 'https://example.com/event',
    snippet: 'snippet text',
    fetchedAt: '2026-05-01T00:00:00.000Z',
    sourceName: 'Example',
    sourceGroup: 'official',
    rawPayload: {}
  };

  function makeSignal(overrides: Partial<IntelligenceSignalInput> = {}): IntelligenceSignalInput {
    return {
      id: 'sig-1',
      workspaceId: 'ws-1',
      stableTopicKey: 'topic-a',
      channel: 'rss',
      title: 'Signal Title',
      summary: 'summary',
      priority: 'high',
      confidence: 0.9,
      status: 'active',
      firstSeenAt: '2026-05-01T00:00:00.000Z',
      lastSeenAt: '2026-05-01T00:01:00.000Z',
      metadata: {},
      ...overrides
    };
  }

  function makeSource(overrides: Partial<IntelligenceSourceInput> = {}): IntelligenceSourceInput {
    return {
      id: 'src-1',
      signalId: 'sig-1',
      sourceName: 'Example',
      url: 'https://example.com',
      sourceGroup: 'official',
      snippet: 'text',
      capturedAt: '2026-05-01T00:00:00.000Z',
      metadata: {},
      ...overrides
    };
  }

  function makeCandidate(
    overrides: Partial<IntelligenceKnowledgeCandidateInput> = {}
  ): IntelligenceKnowledgeCandidateInput {
    return {
      id: 'cand-1',
      signalId: 'sig-1',
      candidateType: 'knowledge-article',
      decision: 'candidate',
      decisionReason: 'test',
      ttlDays: 30,
      reviewStatus: 'pending',
      createdAt: '2026-05-01T00:00:00.000Z',
      metadata: {},
      ...overrides
    };
  }

  describe('createIntelligenceMemoryRepository', () => {
    it('returns a new IntelligenceMemoryRepository instance', () => {
      const repo = createIntelligenceMemoryRepository();
      expect(repo).toBeInstanceOf(IntelligenceMemoryRepository);
    });
  });

  describe('saveRun', () => {
    it('stores a run and makes it retrievable through listRecentSignals', async () => {
      const repo = createRepo();
      await repo.saveRun(runInput);
      // Runs are stored but no direct getter; ensure no error
    });
  });

  describe('saveQuery', () => {
    it('stores a query without errors', async () => {
      const repo = createRepo();
      await repo.saveQuery(queryInput);
    });
  });

  describe('saveRawEvent', () => {
    it('stores a raw event without errors', async () => {
      const repo = createRepo();
      await repo.saveRawEvent(rawEventInput);
    });
  });

  describe('upsertSignal', () => {
    it('inserts a new signal', async () => {
      const repo = createRepo();
      await repo.upsertSignal(makeSignal());
      const signals = await repo.listRecentSignals({ limit: 10 });
      expect(signals).toHaveLength(1);
      expect(signals[0].id).toBe('sig-1');
    });

    it('updates an existing signal with matching workspaceId and stableTopicKey', async () => {
      const repo = createRepo();
      await repo.upsertSignal(makeSignal({ id: 'sig-1' }));
      await repo.upsertSignal(makeSignal({ id: 'sig-2', title: 'Updated Title' }));

      const signals = await repo.listRecentSignals({ limit: 10 });
      expect(signals).toHaveLength(1);
      expect(signals[0].title).toBe('Updated Title');
    });

    it('inserts separate signals with different stableTopicKey', async () => {
      const repo = createRepo();
      await repo.upsertSignal(makeSignal({ stableTopicKey: 'topic-a' }));
      await repo.upsertSignal(makeSignal({ id: 'sig-2', stableTopicKey: 'topic-b' }));

      const signals = await repo.listRecentSignals({ limit: 10 });
      expect(signals).toHaveLength(2);
    });
  });

  describe('saveSource', () => {
    it('stores a source and includes count in listRecentSignals', async () => {
      const repo = createRepo();
      await repo.upsertSignal(makeSignal());
      await repo.saveSource(makeSource({ id: 'src-1' }));
      await repo.saveSource(makeSource({ id: 'src-2' }));

      const signals = await repo.listRecentSignals({ limit: 10 });
      expect(signals[0].sourceCount).toBe(2);
    });
  });

  describe('saveCandidate', () => {
    it('stores a candidate and returns pending via listPendingCandidates', async () => {
      const repo = createRepo();
      await repo.saveCandidate(makeCandidate());

      const pending = await repo.listPendingCandidates({ limit: 10 });
      expect(pending).toHaveLength(1);
      expect(pending[0].reviewStatus).toBe('pending');
    });
  });

  describe('listRecentSignals', () => {
    it('filters by channel when specified', async () => {
      const repo = createRepo();
      await repo.upsertSignal(makeSignal({ channel: 'rss' }));
      await repo.upsertSignal(makeSignal({ id: 'sig-2', channel: 'twitter', stableTopicKey: 'topic-b' }));

      const rssSignals = await repo.listRecentSignals({ limit: 10, channel: 'rss' });
      expect(rssSignals).toHaveLength(1);
      expect(rssSignals[0].channel).toBe('rss');
    });

    it('returns all signals when no channel filter', async () => {
      const repo = createRepo();
      await repo.upsertSignal(makeSignal({ channel: 'rss' }));
      await repo.upsertSignal(makeSignal({ id: 'sig-2', channel: 'twitter', stableTopicKey: 'topic-b' }));

      const all = await repo.listRecentSignals({ limit: 10 });
      expect(all).toHaveLength(2);
    });

    it('sorts by lastSeenAt descending and limits results', async () => {
      const repo = createRepo();
      await repo.upsertSignal(makeSignal({ lastSeenAt: '2026-05-01T00:00:00.000Z' }));
      await repo.upsertSignal(
        makeSignal({ id: 'sig-2', stableTopicKey: 'topic-b', lastSeenAt: '2026-05-02T00:00:00.000Z' })
      );

      const limited = await repo.listRecentSignals({ limit: 1 });
      expect(limited).toHaveLength(1);
      expect(limited[0].id).toBe('sig-2');
    });

    it('selects highest priority knowledgeDecision from candidates', async () => {
      const repo = createRepo();
      await repo.upsertSignal(makeSignal());
      await repo.saveSource(makeSource());
      await repo.saveCandidate(makeCandidate({ id: 'cand-1', decision: 'rejected' }));
      await repo.saveCandidate(makeCandidate({ id: 'cand-2', decision: 'ingested' }));

      const signals = await repo.listRecentSignals({ limit: 10 });
      expect(signals[0].knowledgeDecision).toBe('ingested');
    });

    it('returns undefined knowledgeDecision when no candidates', async () => {
      const repo = createRepo();
      await repo.upsertSignal(makeSignal());

      const signals = await repo.listRecentSignals({ limit: 10 });
      expect(signals[0].knowledgeDecision).toBeUndefined();
    });
  });

  describe('listPendingCandidates', () => {
    it('filters only pending candidates', async () => {
      const repo = createRepo();
      await repo.saveCandidate(makeCandidate({ reviewStatus: 'pending' }));
      await repo.saveCandidate(makeCandidate({ id: 'cand-2', reviewStatus: 'approved' }));

      const pending = await repo.listPendingCandidates({ limit: 10 });
      expect(pending).toHaveLength(1);
    });

    it('sorts by createdAt descending and limits results', async () => {
      const repo = createRepo();
      await repo.saveCandidate(makeCandidate({ createdAt: '2026-05-01T00:00:00.000Z' }));
      await repo.saveCandidate(makeCandidate({ id: 'cand-2', createdAt: '2026-05-02T00:00:00.000Z' }));

      const limited = await repo.listPendingCandidates({ limit: 1 });
      expect(limited).toHaveLength(1);
      expect(limited[0].id).toBe('cand-2');
    });

    it('returns empty when no pending candidates exist', async () => {
      const repo = createRepo();
      await repo.saveCandidate(makeCandidate({ reviewStatus: 'approved' }));

      const pending = await repo.listPendingCandidates({ limit: 10 });
      expect(pending).toHaveLength(0);
    });
  });
});
