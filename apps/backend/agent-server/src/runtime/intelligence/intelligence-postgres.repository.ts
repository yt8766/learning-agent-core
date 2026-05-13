import {
  IntelligenceKnowledgeCandidateSchema,
  IntelligenceSignalSchema,
  type IntelligenceKnowledgeCandidate,
  type IntelligenceSignal
} from '@agent/core';

import type {
  IntelligenceKnowledgeCandidateInput,
  IntelligenceQueryInput,
  IntelligenceRawEventInput,
  IntelligenceRepository,
  IntelligenceRunInput,
  IntelligenceSignalInput,
  IntelligenceSourceInput
} from './intelligence.repository';

export interface IntelligencePostgresClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export function createIntelligencePostgresRepository(client: IntelligencePostgresClient): IntelligenceRepository {
  return new IntelligencePostgresRepository(client);
}

export class IntelligencePostgresRepository implements IntelligenceRepository {
  constructor(private readonly client: IntelligencePostgresClient) {}

  async saveRun(input: IntelligenceRunInput): Promise<void> {
    await this.client.query(
      `insert into intel_search_runs
        (id, workspace_id, run_kind, status, started_at, completed_at, triggered_by, summary, error)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do update set
         status = excluded.status,
         completed_at = excluded.completed_at,
         triggered_by = excluded.triggered_by,
         summary = excluded.summary,
         error = excluded.error`,
      [
        input.id,
        input.workspaceId,
        input.runKind,
        input.status,
        input.startedAt,
        input.completedAt ?? null,
        input.triggeredBy ?? null,
        JSON.stringify(input.summary),
        input.error ? JSON.stringify(input.error) : null
      ]
    );
  }

  async saveQuery(input: IntelligenceQueryInput): Promise<void> {
    await this.client.query(
      `insert into intel_search_queries
        (id, run_id, channel, direction, query, provider, status, started_at, completed_at, result_count, error)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update set
         status = excluded.status,
         completed_at = excluded.completed_at,
         result_count = excluded.result_count,
         error = excluded.error`,
      [
        input.id,
        input.runId,
        input.channel,
        input.direction,
        input.query,
        input.provider,
        input.status,
        input.startedAt,
        input.completedAt ?? null,
        input.resultCount,
        input.error ? JSON.stringify(input.error) : null
      ]
    );
  }

  async saveRawEvent(input: IntelligenceRawEventInput): Promise<void> {
    await this.client.query(
      `insert into intel_raw_events
        (id, query_id, content_hash, title, url, snippet, published_at, fetched_at, source_name, source_url, source_group, raw_payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (query_id, content_hash) do update set
         title = excluded.title,
         url = excluded.url,
         snippet = excluded.snippet,
         published_at = excluded.published_at,
         fetched_at = excluded.fetched_at,
         source_name = excluded.source_name,
         source_url = excluded.source_url,
         source_group = excluded.source_group,
         raw_payload = excluded.raw_payload`,
      [
        input.id,
        input.queryId,
        input.contentHash,
        input.title,
        input.url,
        input.snippet,
        input.publishedAt ?? null,
        input.fetchedAt,
        input.sourceName,
        input.sourceUrl ?? null,
        input.sourceGroup,
        JSON.stringify(input.rawPayload)
      ]
    );
  }

  async upsertSignal(input: IntelligenceSignalInput): Promise<void> {
    await this.client.query(
      `insert into intel_signals
        (id, workspace_id, stable_topic_key, channel, title, summary, priority, confidence, status, first_seen_at, last_seen_at, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict (workspace_id, stable_topic_key) do update set
         channel = excluded.channel,
         title = excluded.title,
         summary = excluded.summary,
         priority = excluded.priority,
         confidence = excluded.confidence,
         status = excluded.status,
         last_seen_at = excluded.last_seen_at,
         metadata = excluded.metadata`,
      [
        input.id,
        input.workspaceId,
        input.stableTopicKey,
        input.channel,
        input.title,
        input.summary,
        input.priority,
        input.confidence,
        input.status,
        input.firstSeenAt,
        input.lastSeenAt,
        JSON.stringify(input.metadata)
      ]
    );
  }

  async saveSource(input: IntelligenceSourceInput): Promise<void> {
    await this.client.query(
      `insert into intel_signal_sources
        (id, signal_id, raw_event_id, source_name, source_url, url, source_group, snippet, published_at, captured_at, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update set
         raw_event_id = excluded.raw_event_id,
         source_name = excluded.source_name,
         source_url = excluded.source_url,
         url = excluded.url,
         source_group = excluded.source_group,
         snippet = excluded.snippet,
         published_at = excluded.published_at,
         captured_at = excluded.captured_at,
         metadata = excluded.metadata`,
      [
        input.id,
        input.signalId,
        input.rawEventId ?? null,
        input.sourceName,
        input.sourceUrl ?? null,
        input.url,
        input.sourceGroup,
        input.snippet,
        input.publishedAt ?? null,
        input.capturedAt,
        JSON.stringify(input.metadata)
      ]
    );
  }

  async saveCandidate(input: IntelligenceKnowledgeCandidateInput): Promise<void> {
    await this.client.query(
      `insert into intel_knowledge_candidates
        (id, signal_id, candidate_type, decision, decision_reason, ttl_days, created_at, review_status, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do update set
         candidate_type = excluded.candidate_type,
         decision = excluded.decision,
         decision_reason = excluded.decision_reason,
         ttl_days = excluded.ttl_days,
         review_status = excluded.review_status,
         metadata = excluded.metadata`,
      [
        input.id,
        input.signalId,
        input.candidateType,
        input.decision,
        input.decisionReason,
        input.ttlDays ?? null,
        input.createdAt,
        input.reviewStatus,
        JSON.stringify(input.metadata)
      ]
    );
  }

  async listRecentSignals(input: {
    limit: number;
    channel?: IntelligenceSignal['channel'];
  }): Promise<IntelligenceSignal[]> {
    const result = input.channel
      ? await this.client.query(
          `select
             s.id,
             s.channel,
             s.title,
             s.summary,
             s.priority,
             s.confidence,
             s.status,
             s.first_seen_at,
             s.last_seen_at,
             count(distinct ss.id) as source_count,
             case max(
               case c.decision
                 when 'ingested' then 4
                 when 'candidate' then 3
                 when 'needs_review' then 2
                 when 'rejected' then 1
                 else 0
               end
             )
               when 4 then 'ingested'
               when 3 then 'candidate'
               when 2 then 'needs_review'
               when 1 then 'rejected'
             end as knowledge_decision
           from intel_signals s
           left join intel_signal_sources ss on ss.signal_id = s.id
           left join intel_knowledge_candidates c on c.signal_id = s.id
           where s.channel = $2
           group by
             s.id,
             s.channel,
             s.title,
             s.summary,
             s.priority,
             s.confidence,
             s.status,
             s.first_seen_at,
             s.last_seen_at
           order by s.last_seen_at desc
           limit $1`,
          [input.limit, input.channel]
        )
      : await this.client.query(
          `select
             s.id,
             s.channel,
             s.title,
             s.summary,
             s.priority,
             s.confidence,
             s.status,
             s.first_seen_at,
             s.last_seen_at,
             count(distinct ss.id) as source_count,
             case max(
               case c.decision
                 when 'ingested' then 4
                 when 'candidate' then 3
                 when 'needs_review' then 2
                 when 'rejected' then 1
                 else 0
               end
             )
               when 4 then 'ingested'
               when 3 then 'candidate'
               when 2 then 'needs_review'
               when 1 then 'rejected'
             end as knowledge_decision
           from intel_signals s
           left join intel_signal_sources ss on ss.signal_id = s.id
           left join intel_knowledge_candidates c on c.signal_id = s.id
           group by
             s.id,
             s.channel,
             s.title,
             s.summary,
             s.priority,
             s.confidence,
             s.status,
             s.first_seen_at,
             s.last_seen_at
           order by s.last_seen_at desc
           limit $1`,
          [input.limit]
        );
    return result.rows.map(mapSignalRow);
  }

  async listPendingCandidates(input: { limit: number }): Promise<IntelligenceKnowledgeCandidate[]> {
    const result = await this.client.query(
      `select
         id,
         signal_id,
         candidate_type,
         decision,
         decision_reason,
         ttl_days,
         review_status,
         created_at
       from intel_knowledge_candidates
       where review_status = $2
       order by created_at desc
       limit $1`,
      [input.limit, 'pending']
    );
    return result.rows.map(mapCandidateRow);
  }
}

function mapSignalRow(row: Record<string, unknown>): IntelligenceSignal {
  const parsed = IntelligenceSignalSchema.safeParse({
    id: stringValue(row.id),
    channel: stringValue(row.channel),
    title: stringValue(row.title),
    summary: stringValue(row.summary),
    priority: stringValue(row.priority),
    confidence: stringValue(row.confidence),
    status: stringValue(row.status),
    firstSeenAt: dateString(row.first_seen_at),
    lastSeenAt: dateString(row.last_seen_at),
    sourceCount: numberValue(row.source_count),
    knowledgeDecision: optionalString(row.knowledge_decision)
  });
  if (!parsed.success) {
    throw new Error(`intelligence_signal_row_invalid:${parsed.error.issues[0]?.path.join('.') ?? 'unknown'}`);
  }
  return parsed.data;
}

function mapCandidateRow(row: Record<string, unknown>): IntelligenceKnowledgeCandidate {
  const parsed = IntelligenceKnowledgeCandidateSchema.safeParse({
    id: stringValue(row.id),
    signalId: stringValue(row.signal_id),
    candidateType: stringValue(row.candidate_type),
    decision: stringValue(row.decision),
    decisionReason: stringValue(row.decision_reason),
    ttlDays: optionalNumber(row.ttl_days),
    reviewStatus: stringValue(row.review_status),
    createdAt: dateString(row.created_at)
  });
  if (!parsed.success) {
    throw new Error(`intelligence_candidate_row_invalid:${parsed.error.issues[0]?.path.join('.') ?? 'unknown'}`);
  }
  return parsed.data;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    return Number(value);
  }
  return 0;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return numberValue(value);
}

function dateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return stringValue(value);
}
