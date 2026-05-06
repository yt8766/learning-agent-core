import { expect, vi } from 'vitest';

import type { KnowledgeSqlClient } from '../../src/knowledge/repositories/knowledge-sql-client';

const now = '2026-05-01T09:00:00.000Z';

export class FakeKnowledgeSqlClient implements KnowledgeSqlClient {
  readonly query = vi.fn(async (sql: string, params: readonly unknown[] = []) => this.route(sql, params));
  readonly serializedWrites: string[] = [];

  private readonly knowledgeBases: Array<Record<string, unknown>> = [];
  private readonly documents: Array<Record<string, unknown>> = [];
  private readonly chunks: Array<Record<string, unknown>> = [];
  private readonly evalRuns: Array<Record<string, unknown>> = [];
  private readonly evalResults: Array<Record<string, unknown>> = [];
  private readonly traces: Array<Record<string, unknown>> = [];

  private route(sql: string, params: readonly unknown[]) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized.includes('insert into knowledge_bases')) {
      return { rows: [this.upsert(this.knowledgeBases, this.baseRow(normalized, params), matchesTenantId)] };
    }
    if (normalized.includes('insert into knowledge_documents')) {
      return { rows: [this.upsert(this.documents, this.documentRow(normalized, params), matchesDocumentIdentity)] };
    }
    if (normalized.includes('from knowledge_documents')) {
      return { rows: this.documents.filter(row => row.tenant_id === params[0] && row.knowledge_base_id === params[1]) };
    }
    if (normalized.includes('insert into knowledge_chunks')) {
      return { rows: [this.upsert(this.chunks, this.chunkRow(normalized, params), matchesTenantId)] };
    }
    if (normalized.includes('from knowledge_chunks')) {
      return {
        rows: this.chunks.filter(
          row =>
            row.tenant_id === params[0] &&
            matchesOptional(row, 'knowledge_base_id', params[1]) &&
            matchesOptional(row, 'document_id', params[2])
        )
      };
    }
    if (normalized.includes('insert into knowledge_eval_runs')) {
      return { rows: [this.upsert(this.evalRuns, this.evalRunRow(normalized, params), matchesTenantId)] };
    }
    if (normalized.includes('update knowledge_eval_runs')) {
      const row = this.evalRunUpdateRow(normalized, params);
      return { rows: [this.upsert(this.evalRuns, row, matchesTenantId)] };
    }
    if (normalized.includes('insert into knowledge_eval_results')) {
      return { rows: [this.upsert(this.evalResults, this.evalResultRow(normalized, params), matchesTenantId)] };
    }
    if (normalized.includes('from knowledge_eval_results')) {
      return { rows: this.evalResults.filter(row => row.tenant_id === params[0] && row.run_id === params[1]) };
    }
    if (normalized.includes('insert into knowledge_traces')) {
      return { rows: [this.upsert(this.traces, this.traceRow(normalized, params), matchesTenantId)] };
    }
    if (normalized.includes('from knowledge_traces') && normalized.includes('and id = $2')) {
      return { rows: this.traces.filter(row => row.tenant_id === params[0] && row.id === params[1]) };
    }
    if (normalized.includes('from knowledge_traces')) {
      return { rows: this.traces.filter(row => row.tenant_id === params[0] && matchesTraceFilters(row, params)) };
    }
    return { rows: [] };
  }

  private baseRow(sql: string, params: readonly unknown[]) {
    return {
      id: params[0],
      tenant_id: params[1],
      name: params[2],
      description: params[3],
      visibility: params[4],
      status: params[5],
      tags: this.json(sql, 'knowledge_bases.tags', params[6]),
      metadata: this.json(sql, 'knowledge_bases.metadata', params[7]),
      created_by: params[8],
      created_at: params[9],
      updated_at: params[10]
    };
  }

  private documentRow(sql: string, params: readonly unknown[]) {
    return {
      id: params[0],
      tenant_id: params[1],
      knowledge_base_id: params[2],
      title: params[3],
      status: params[4],
      source_uri: params[5],
      mime_type: params[6],
      metadata: this.json(sql, 'knowledge_documents.metadata', params[7]),
      error_message: params[8],
      created_at: params[9],
      updated_at: params[10]
    };
  }

  private chunkRow(sql: string, params: readonly unknown[]) {
    return {
      id: params[0],
      tenant_id: params[1],
      knowledge_base_id: params[2],
      document_id: params[3],
      text: params[4],
      ordinal: params[5],
      token_count: params[6],
      embedding: this.vector(sql, 'knowledge_chunks.embedding', params[7]),
      metadata: this.json(sql, 'knowledge_chunks.metadata', params[8]),
      created_at: params[9],
      updated_at: params[10]
    };
  }

  private evalRunRow(sql: string, params: readonly unknown[]) {
    return {
      id: params[0],
      tenant_id: params[1],
      dataset_id: params[2],
      knowledge_base_id: params[3],
      status: params[4],
      metrics: this.json(sql, 'knowledge_eval_runs.metrics', params[5]),
      summary: this.json(sql, 'knowledge_eval_runs.summary', params[6]),
      created_by: params[8],
      error_message: params[9],
      metadata: this.json(sql, 'knowledge_eval_runs.metadata', params[7]),
      created_at: params[10],
      updated_at: params[11]
    };
  }

  private evalRunUpdateRow(sql: string, params: readonly unknown[]) {
    return {
      tenant_id: params[0],
      id: params[1],
      dataset_id: params[2],
      knowledge_base_id: params[3],
      status: params[4],
      metrics: this.json(sql, 'knowledge_eval_runs.metrics', params[5]),
      summary: this.json(sql, 'knowledge_eval_runs.summary', params[6]),
      metadata: this.json(sql, 'knowledge_eval_runs.metadata', params[7]),
      created_by: params[8],
      error_message: params[9],
      updated_at: params[10],
      created_at: now
    };
  }

  private evalResultRow(sql: string, params: readonly unknown[]) {
    return {
      id: params[0],
      tenant_id: params[1],
      run_id: params[2],
      case_id: params[3],
      status: params[4],
      question: params[5],
      actual_answer: params[6],
      retrieved_chunk_ids: this.json(sql, 'knowledge_eval_results.retrieved_chunk_ids', params[7]),
      citations: this.json(sql, 'knowledge_eval_results.citations', params[8]),
      retrieval_metrics: this.json(sql, 'knowledge_eval_results.retrieval_metrics', params[9]),
      generation_metrics: this.json(sql, 'knowledge_eval_results.generation_metrics', params[10]),
      trace_id: params[11],
      error_message: params[12],
      created_at: params[13],
      updated_at: params[14]
    };
  }

  private traceRow(sql: string, params: readonly unknown[]) {
    return {
      id: params[0],
      tenant_id: params[1],
      operation: params[2],
      status: params[3],
      knowledge_base_ids: this.json(sql, 'knowledge_traces.knowledge_base_ids', params[4]),
      conversation_id: params[5],
      message_id: params[6],
      latency_ms: params[7],
      spans: this.json(sql, 'knowledge_traces.spans', params[8]),
      metadata: this.json(sql, 'knowledge_traces.metadata', params[9]),
      error_message: params[10],
      created_at: params[11],
      updated_at: params[12]
    };
  }

  private json(sql: string, label: string, value: unknown): unknown {
    expect(sql).toContain('::jsonb');
    expect(typeof value).toBe('string');
    this.serializedWrites.push(label);
    return JSON.parse(value as string);
  }

  private vector(sql: string, label: string, value: unknown): unknown {
    expect(sql).toContain('::vector');
    expect(typeof value).toBe('string');
    const dimensions = JSON.parse(value as string) as number[];
    expect(dimensions).toHaveLength(1024);
    expect(dimensions.slice(0, 3)).toEqual([0.1, 0.2, 0.3]);
    this.serializedWrites.push(label);
    return value;
  }

  private upsert(
    rows: Array<Record<string, unknown>>,
    next: Record<string, unknown>,
    matcher: (left: Record<string, unknown>, right: Record<string, unknown>) => boolean
  ) {
    const index = rows.findIndex(row => matcher(row, next));
    if (index >= 0) rows[index] = next;
    else rows.push(next);
    return next;
  }
}

function matchesDocumentIdentity(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return (
    left.tenant_id === right.tenant_id && left.knowledge_base_id === right.knowledge_base_id && left.id === right.id
  );
}

function matchesTenantId(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return left.tenant_id === right.tenant_id && left.id === right.id;
}

function matchesOptional(row: Record<string, unknown>, key: string, value: unknown): boolean {
  return value === null || row[key] === value;
}

function matchesTraceFilters(row: Record<string, unknown>, params: readonly unknown[]): boolean {
  return (
    matchesOptional(row, 'operation', params[2]) &&
    matchesOptional(row, 'status', params[3]) &&
    (params[1] === null || (row.knowledge_base_ids as unknown[]).includes(params[1]))
  );
}
