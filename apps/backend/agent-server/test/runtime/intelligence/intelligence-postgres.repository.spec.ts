import { describe, expect, it, vi } from 'vitest';

import { RUNTIME_SCHEMA_SQL } from '../../../src/infrastructure/database/schemas/runtime-schema.sql';
import { createIntelligencePostgresRepository } from '../../../src/runtime/intelligence/intelligence-postgres.repository';

describe('intelligence postgres repository', () => {
  it('declares intel tables in the runtime schema', () => {
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_search_runs');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_search_queries');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_raw_events');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_signals');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_signal_sources');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_daily_digests');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_knowledge_candidates');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS intel_knowledge_ingestions');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE INDEX IF NOT EXISTS intel_signals_channel_last_seen_idx');
    expect(RUNTIME_SCHEMA_SQL).toContain('CREATE INDEX IF NOT EXISTS intel_candidates_review_status_idx');
  });

  it('writes run, query, raw event, signal, source, and candidate records through parameterized SQL', async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const client = {
      query: vi.fn(async (text: string, values: unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes('from intel_signals')) {
          return {
            rows: [
              {
                id: 'sig_1',
                channel: 'llm-releases',
                title: 'New LLM',
                summary: 'A new model changes routing.',
                priority: 'P1',
                confidence: 'high',
                status: 'confirmed',
                first_seen_at: '2026-05-10T01:00:00.000Z',
                last_seen_at: '2026-05-10T01:00:00.000Z',
                source_count: '1',
                knowledge_decision: 'candidate'
              }
            ]
          };
        }
        if (text.includes('from intel_knowledge_candidates')) {
          return {
            rows: [
              {
                id: 'cand_1',
                signal_id: 'sig_1',
                candidate_type: 'knowledge',
                decision: 'candidate',
                decision_reason: 'Official release affects model routing.',
                ttl_days: 180,
                review_status: 'pending',
                created_at: '2026-05-10T01:00:00.000Z'
              }
            ]
          };
        }
        return { rows: [] };
      })
    };
    const repository = createIntelligencePostgresRepository(client);

    await repository.saveRun({
      id: 'run_1',
      workspaceId: 'workspace',
      runKind: 'manual',
      status: 'running',
      startedAt: '2026-05-10T01:00:00.000Z',
      summary: {}
    });
    await repository.saveQuery({
      id: 'query_1',
      runId: 'run_1',
      channel: 'llm-releases',
      direction: 'official-confirmation',
      query: 'OpenAI new model release latest',
      provider: 'minimax-cli',
      status: 'completed',
      startedAt: '2026-05-10T01:00:00.000Z',
      resultCount: 1
    });
    await repository.saveRawEvent({
      id: 'raw_1',
      queryId: 'query_1',
      contentHash: 'hash_1',
      title: 'New LLM',
      url: 'https://example.com/model',
      snippet: 'A release note.',
      fetchedAt: '2026-05-10T01:00:00.000Z',
      sourceName: 'Example',
      sourceGroup: 'official',
      rawPayload: { title: 'New LLM' }
    });
    await repository.upsertSignal({
      id: 'sig_1',
      workspaceId: 'workspace',
      stableTopicKey: 'llm:new-model',
      channel: 'llm-releases',
      title: 'New LLM',
      summary: 'A new model changes routing.',
      priority: 'P1',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-05-10T01:00:00.000Z',
      lastSeenAt: '2026-05-10T01:00:00.000Z',
      metadata: {}
    });
    await repository.saveSource({
      id: 'src_1',
      signalId: 'sig_1',
      rawEventId: 'raw_1',
      sourceName: 'Example',
      url: 'https://example.com/model',
      sourceGroup: 'official',
      snippet: 'A release note.',
      capturedAt: '2026-05-10T01:00:00.000Z',
      metadata: {}
    });
    await repository.saveCandidate({
      id: 'cand_1',
      signalId: 'sig_1',
      candidateType: 'knowledge',
      decision: 'candidate',
      decisionReason: 'Official release affects model routing.',
      ttlDays: 180,
      createdAt: '2026-05-10T01:00:00.000Z',
      reviewStatus: 'pending',
      metadata: {}
    });

    const signals = await repository.listRecentSignals({ limit: 5 });
    const candidates = await repository.listPendingCandidates({ limit: 5 });

    expect(signals).toEqual([
      {
        id: 'sig_1',
        channel: 'llm-releases',
        title: 'New LLM',
        summary: 'A new model changes routing.',
        priority: 'P1',
        confidence: 'high',
        status: 'confirmed',
        firstSeenAt: '2026-05-10T01:00:00.000Z',
        lastSeenAt: '2026-05-10T01:00:00.000Z',
        sourceCount: 1,
        knowledgeDecision: 'candidate'
      }
    ]);
    expect(candidates).toEqual([
      {
        id: 'cand_1',
        signalId: 'sig_1',
        candidateType: 'knowledge',
        decision: 'candidate',
        decisionReason: 'Official release affects model routing.',
        ttlDays: 180,
        reviewStatus: 'pending',
        createdAt: '2026-05-10T01:00:00.000Z'
      }
    ]);
    expect(calls.every(call => Array.isArray(call.values))).toBe(true);
    expect(calls[0]?.text).toContain('insert into intel_search_runs');
    expect(calls[0]?.values).toEqual([
      'run_1',
      'workspace',
      'manual',
      'running',
      '2026-05-10T01:00:00.000Z',
      null,
      null,
      '{}',
      null
    ]);
    expect(calls.some(call => call.text.includes('insert into intel_signal_sources'))).toBe(true);
    expect(calls.some(call => call.text.includes('limit $1'))).toBe(true);
  });

  it('aggregates candidate decisions without duplicating signals', async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const client = {
      query: vi.fn(async (text: string, values: unknown[] = []) => {
        calls.push({ text, values });
        return {
          rows: [
            {
              id: 'sig_1',
              channel: 'llm-releases',
              title: 'New LLM',
              summary: 'A new model changes routing.',
              priority: 'P1',
              confidence: 'high',
              status: 'confirmed',
              first_seen_at: '2026-05-10T01:00:00.000Z',
              last_seen_at: '2026-05-10T01:00:00.000Z',
              source_count: '2',
              knowledge_decision: 'ingested'
            }
          ]
        };
      })
    };
    const repository = createIntelligencePostgresRepository(client);

    const signals = await repository.listRecentSignals({ limit: 5 });
    const signalQuery = calls[0]?.text ?? '';

    expect(signals).toHaveLength(1);
    expect(signals[0]?.knowledgeDecision).toBe('ingested');
    expect(signalQuery).toContain('case max(');
    expect(signalQuery).toContain("when 'ingested' then 4");
    expect(signalQuery).not.toMatch(/group by[\s\S]*c\.decision/i);
  });
});
