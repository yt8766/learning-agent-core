import { Injectable } from '@nestjs/common';

import type { KnowledgeSqlClient } from './knowledge-sql-client';
import type {
  KnowledgeBaseRecord,
  KnowledgeChatMessageRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeEvalDatasetRecord,
  KnowledgeEvalResultRecord,
  KnowledgeEvalRunRecord,
  KnowledgeTraceRecord
} from '../interfaces/knowledge-records.types';
import type {
  KnowledgeChatMessageQuery,
  KnowledgeChunkQuery,
  KnowledgeDocumentQuery,
  KnowledgeEvalDatasetDetailQuery,
  KnowledgeEvalResultQuery,
  KnowledgeEvalRunDetailQuery,
  KnowledgeEvalRunQuery,
  KnowledgeRepository,
  KnowledgeRepositoryListResult,
  KnowledgeTenantQuery,
  KnowledgeTraceDetailQuery,
  KnowledgeTraceQuery
} from './knowledge.repository';
import {
  mapChatMessageRow,
  mapChunkRow,
  mapDocumentRow,
  mapEvalDatasetRow,
  mapEvalResultRow,
  mapEvalRunRow,
  mapKnowledgeBaseRow,
  mapTraceRow,
  type KnowledgeBaseRow,
  type KnowledgeChatMessageRow,
  type KnowledgeChunkRow,
  type KnowledgeDocumentRow,
  type KnowledgeEvalDatasetRow,
  type KnowledgeEvalResultRow,
  type KnowledgeEvalRunRow,
  type KnowledgeTraceRow
} from './knowledge-postgres.mapper';
import { firstKnowledgeRow, jsonParam, vectorParam } from './knowledge-postgres.repository.helpers';

@Injectable()
export class PostgresKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly client: KnowledgeSqlClient) {}

  createKnowledgeBase(record: KnowledgeBaseRecord): Promise<KnowledgeBaseRecord> {
    return this.queryOne(
      `insert into knowledge_bases (id, tenant_id, name, description, visibility, status, tags, metadata, created_by, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11)
       on conflict (tenant_id, id) do update set name = excluded.name, description = excluded.description, visibility = excluded.visibility, status = excluded.status, tags = excluded.tags, metadata = excluded.metadata, created_by = excluded.created_by, updated_at = excluded.updated_at
       returning *`,
      [
        record.id,
        record.tenantId,
        record.name,
        record.description ?? null,
        record.visibility,
        record.status,
        jsonParam(record.tags),
        jsonParam(record.metadata ?? {}),
        record.createdBy,
        record.createdAt,
        record.updatedAt
      ],
      mapKnowledgeBaseRow
    );
  }

  listKnowledgeBases(query: KnowledgeTenantQuery): Promise<KnowledgeRepositoryListResult<KnowledgeBaseRecord>> {
    return this.queryList(
      `select * from knowledge_bases where tenant_id = $1 order by updated_at desc`,
      [query.tenantId],
      mapKnowledgeBaseRow
    );
  }

  createDocument(record: KnowledgeDocumentRecord): Promise<KnowledgeDocumentRecord> {
    return this.queryOne<KnowledgeDocumentRow, KnowledgeDocumentRecord>(
      `insert into knowledge_documents (id, tenant_id, knowledge_base_id, title, status, source_uri, mime_type, metadata, error_message, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
       on conflict (tenant_id, knowledge_base_id, id) do update set title = excluded.title, status = excluded.status, source_uri = excluded.source_uri, mime_type = excluded.mime_type, metadata = excluded.metadata, error_message = excluded.error_message, updated_at = excluded.updated_at
       returning *`,
      [
        record.id,
        record.tenantId,
        record.knowledgeBaseId,
        record.title,
        record.status,
        record.sourceUri ?? null,
        record.mimeType ?? null,
        jsonParam(record.metadata ?? {}),
        record.errorMessage ?? null,
        record.createdAt,
        record.updatedAt
      ],
      mapDocumentRow
    );
  }

  listDocuments(query: KnowledgeDocumentQuery): Promise<KnowledgeRepositoryListResult<KnowledgeDocumentRecord>> {
    return this.queryList<KnowledgeDocumentRow, KnowledgeDocumentRecord>(
      `select * from knowledge_documents where tenant_id = $1 and knowledge_base_id = $2 order by updated_at desc`,
      [query.tenantId, query.knowledgeBaseId],
      mapDocumentRow
    );
  }

  async createChunk(record: KnowledgeChunkRecord): Promise<KnowledgeChunkRecord> {
    return this.queryOne<KnowledgeChunkRow, KnowledgeChunkRecord>(
      `insert into knowledge_chunks (id, tenant_id, knowledge_base_id, document_id, text, ordinal, token_count, embedding, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::vector,$9::jsonb,$10,$11)
       on conflict (tenant_id, id) do update set knowledge_base_id = excluded.knowledge_base_id, document_id = excluded.document_id, text = excluded.text, ordinal = excluded.ordinal, token_count = excluded.token_count, embedding = excluded.embedding, metadata = excluded.metadata, updated_at = excluded.updated_at
       returning *`,
      [
        record.id,
        record.tenantId,
        record.knowledgeBaseId,
        record.documentId,
        record.text,
        record.ordinal ?? 0,
        record.tokenCount ?? null,
        vectorParam(record.embedding),
        jsonParam(record.metadata ?? {}),
        record.createdAt,
        record.updatedAt
      ],
      mapChunkRow
    );
  }

  listChunks(query: KnowledgeChunkQuery): Promise<KnowledgeRepositoryListResult<KnowledgeChunkRecord>> {
    return this.queryList<KnowledgeChunkRow, KnowledgeChunkRecord>(
      `select * from knowledge_chunks
       where tenant_id = $1 and ($2::text is null or knowledge_base_id = $2) and ($3::text is null or document_id = $3)
       order by ordinal asc, created_at asc`,
      [query.tenantId, query.knowledgeBaseId ?? null, query.documentId ?? null],
      mapChunkRow
    );
  }

  createChatMessage(record: KnowledgeChatMessageRecord): Promise<KnowledgeChatMessageRecord> {
    return this.queryOne<KnowledgeChatMessageRow, KnowledgeChatMessageRecord>(
      `insert into knowledge_chat_messages (id, tenant_id, conversation_id, role, content, knowledge_base_id, citations, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)
       on conflict (tenant_id, id) do update set conversation_id = excluded.conversation_id, role = excluded.role, content = excluded.content, knowledge_base_id = excluded.knowledge_base_id, citations = excluded.citations, metadata = excluded.metadata, updated_at = excluded.updated_at
       returning *`,
      [
        record.id,
        record.tenantId,
        record.conversationId,
        record.role,
        record.content,
        record.knowledgeBaseId ?? null,
        jsonParam(record.citations ?? []),
        jsonParam(record.metadata ?? {}),
        record.createdAt,
        record.updatedAt
      ],
      mapChatMessageRow
    );
  }

  listChatMessages(
    query: KnowledgeChatMessageQuery
  ): Promise<KnowledgeRepositoryListResult<KnowledgeChatMessageRecord>> {
    return this.queryList<KnowledgeChatMessageRow, KnowledgeChatMessageRecord>(
      `select * from knowledge_chat_messages where tenant_id = $1 and conversation_id = $2 order by created_at asc`,
      [query.tenantId, query.conversationId],
      mapChatMessageRow
    );
  }

  createEvalRun(record: KnowledgeEvalRunRecord): Promise<KnowledgeEvalRunRecord> {
    return this.writeEvalRun(record);
  }

  listEvalRuns(query: KnowledgeEvalRunQuery): Promise<KnowledgeRepositoryListResult<KnowledgeEvalRunRecord>> {
    return this.queryList<KnowledgeEvalRunRow, KnowledgeEvalRunRecord>(
      `select * from knowledge_eval_runs where tenant_id = $1 and ($2::text is null or dataset_id = $2) order by created_at desc`,
      [query.tenantId, query.datasetId ?? null],
      mapEvalRunRow
    );
  }

  getEvalRun(query: KnowledgeEvalRunDetailQuery): Promise<KnowledgeEvalRunRecord | undefined> {
    return this.queryOptional<KnowledgeEvalRunRow, KnowledgeEvalRunRecord>(
      `select * from knowledge_eval_runs where tenant_id = $1 and id = $2 limit 1`,
      [query.tenantId, query.id],
      mapEvalRunRow
    );
  }

  updateEvalRun(record: KnowledgeEvalRunRecord): Promise<KnowledgeEvalRunRecord> {
    return this.queryOne<KnowledgeEvalRunRow, KnowledgeEvalRunRecord>(
      `update knowledge_eval_runs
       set dataset_id = $3, knowledge_base_id = $4, status = $5, metrics = $6::jsonb, summary = $7::jsonb, metadata = $8::jsonb, created_by = $9, error_message = $10, updated_at = $11
       where tenant_id = $1 and id = $2 returning *`,
      [
        record.tenantId,
        record.id,
        record.datasetId,
        record.knowledgeBaseId ?? null,
        record.status,
        jsonParam(record.metrics ?? {}),
        jsonParam(record.summary ?? {}),
        jsonParam(record.metadata ?? {}),
        record.createdBy ?? null,
        record.errorMessage ?? null,
        record.updatedAt
      ],
      mapEvalRunRow
    );
  }

  createEvalDataset(record: KnowledgeEvalDatasetRecord): Promise<KnowledgeEvalDatasetRecord> {
    return this.queryOne<KnowledgeEvalDatasetRow, KnowledgeEvalDatasetRecord>(
      `insert into knowledge_eval_datasets (id, tenant_id, name, tags, cases, created_by, created_at, updated_at)
       values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8)
       on conflict (tenant_id, id) do update set name = excluded.name, tags = excluded.tags, cases = excluded.cases, created_by = excluded.created_by, updated_at = excluded.updated_at
       returning *`,
      [
        record.id,
        record.tenantId,
        record.name,
        jsonParam(record.tags),
        jsonParam(record.cases),
        record.createdBy,
        record.createdAt,
        record.updatedAt
      ],
      mapEvalDatasetRow
    );
  }

  listEvalDatasets(query: KnowledgeTenantQuery): Promise<KnowledgeRepositoryListResult<KnowledgeEvalDatasetRecord>> {
    return this.queryList<KnowledgeEvalDatasetRow, KnowledgeEvalDatasetRecord>(
      `select * from knowledge_eval_datasets where tenant_id = $1 order by updated_at desc`,
      [query.tenantId],
      mapEvalDatasetRow
    );
  }

  getEvalDataset(query: KnowledgeEvalDatasetDetailQuery): Promise<KnowledgeEvalDatasetRecord | undefined> {
    return this.queryOptional<KnowledgeEvalDatasetRow, KnowledgeEvalDatasetRecord>(
      `select * from knowledge_eval_datasets where tenant_id = $1 and id = $2 limit 1`,
      [query.tenantId, query.id],
      mapEvalDatasetRow
    );
  }

  createEvalResult(record: KnowledgeEvalResultRecord): Promise<KnowledgeEvalResultRecord> {
    return this.queryOne<KnowledgeEvalResultRow, KnowledgeEvalResultRecord>(
      `insert into knowledge_eval_results (id, tenant_id, run_id, case_id, status, question, actual_answer, retrieved_chunk_ids, citations, retrieval_metrics, generation_metrics, trace_id, error_message, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15)
       on conflict (tenant_id, id) do update set run_id = excluded.run_id, case_id = excluded.case_id, status = excluded.status, question = excluded.question, actual_answer = excluded.actual_answer, retrieved_chunk_ids = excluded.retrieved_chunk_ids, citations = excluded.citations, retrieval_metrics = excluded.retrieval_metrics, generation_metrics = excluded.generation_metrics, trace_id = excluded.trace_id, error_message = excluded.error_message, updated_at = excluded.updated_at
       returning *`,
      [
        record.id,
        record.tenantId,
        record.runId,
        record.caseId,
        record.status,
        record.question,
        record.actualAnswer,
        jsonParam(record.retrievedChunkIds),
        jsonParam(record.citations),
        jsonParam(record.retrievalMetrics),
        jsonParam(record.generationMetrics),
        record.traceId ?? null,
        record.errorMessage ?? null,
        record.createdAt,
        record.updatedAt
      ],
      mapEvalResultRow
    );
  }

  listEvalResults(query: KnowledgeEvalResultQuery): Promise<KnowledgeRepositoryListResult<KnowledgeEvalResultRecord>> {
    return this.queryList<KnowledgeEvalResultRow, KnowledgeEvalResultRecord>(
      `select * from knowledge_eval_results where tenant_id = $1 and run_id = $2 order by created_at asc`,
      [query.tenantId, query.runId],
      mapEvalResultRow
    );
  }

  createTrace(record: KnowledgeTraceRecord): Promise<KnowledgeTraceRecord> {
    return this.queryOne<KnowledgeTraceRow, KnowledgeTraceRecord>(
      `insert into knowledge_traces (id, tenant_id, operation, status, knowledge_base_ids, conversation_id, message_id, latency_ms, spans, metadata, error_message, created_at, updated_at)
       values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13)
       on conflict (tenant_id, id) do update set operation = excluded.operation, status = excluded.status, knowledge_base_ids = excluded.knowledge_base_ids, conversation_id = excluded.conversation_id, message_id = excluded.message_id, latency_ms = excluded.latency_ms, spans = excluded.spans, metadata = excluded.metadata, error_message = excluded.error_message, updated_at = excluded.updated_at
       returning *`,
      [
        record.id,
        record.tenantId,
        record.operation,
        record.status,
        jsonParam(record.knowledgeBaseIds),
        record.conversationId ?? null,
        record.messageId ?? null,
        record.latencyMs ?? null,
        jsonParam(record.spans ?? []),
        jsonParam(record.metadata ?? {}),
        record.errorMessage ?? null,
        record.createdAt,
        record.updatedAt
      ],
      mapTraceRow
    );
  }

  listTraces(query: KnowledgeTraceQuery): Promise<KnowledgeRepositoryListResult<KnowledgeTraceRecord>> {
    return this.queryList<KnowledgeTraceRow, KnowledgeTraceRecord>(
      `select * from knowledge_traces
       where tenant_id = $1 and ($2::text is null or knowledge_base_ids @> jsonb_build_array($2)) and ($3::text is null or operation = $3) and ($4::text is null or status = $4)
       order by created_at desc`,
      [query.tenantId, query.knowledgeBaseId ?? null, query.operation ?? null, query.status ?? null],
      mapTraceRow
    );
  }

  getTrace(query: KnowledgeTraceDetailQuery): Promise<KnowledgeTraceRecord | undefined> {
    return this.queryOptional<KnowledgeTraceRow, KnowledgeTraceRecord>(
      `select * from knowledge_traces where tenant_id = $1 and id = $2 limit 1`,
      [query.tenantId, query.id],
      mapTraceRow
    );
  }

  private writeEvalRun(record: KnowledgeEvalRunRecord): Promise<KnowledgeEvalRunRecord> {
    return this.queryOne<KnowledgeEvalRunRow, KnowledgeEvalRunRecord>(
      `insert into knowledge_eval_runs (id, tenant_id, dataset_id, knowledge_base_id, status, metrics, summary, metadata, created_by, error_message, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,$12)
       on conflict (tenant_id, id) do update set dataset_id = excluded.dataset_id, knowledge_base_id = excluded.knowledge_base_id, status = excluded.status, metrics = excluded.metrics, summary = excluded.summary, metadata = excluded.metadata, created_by = excluded.created_by, error_message = excluded.error_message, updated_at = excluded.updated_at
       returning *`,
      [
        record.id,
        record.tenantId,
        record.datasetId,
        record.knowledgeBaseId ?? null,
        record.status,
        jsonParam(record.metrics ?? {}),
        jsonParam(record.summary ?? {}),
        jsonParam(record.metadata ?? {}),
        record.createdBy ?? null,
        record.errorMessage ?? null,
        record.createdAt,
        record.updatedAt
      ],
      mapEvalRunRow
    );
  }

  private async queryOne<Row, Record>(
    sql: string,
    params: readonly unknown[],
    mapper: (row: Row) => Record
  ): Promise<Record> {
    const result = await this.client.query<Row>(sql, params);
    return mapper(firstKnowledgeRow(result.rows));
  }

  private async queryOptional<Row, Record>(
    sql: string,
    params: readonly unknown[],
    mapper: (row: Row) => Record
  ): Promise<Record | undefined> {
    const result = await this.client.query<Row>(sql, params);
    const row = result.rows[0];
    return row ? mapper(row) : undefined;
  }

  private async queryList<Row, Record>(
    sql: string,
    params: readonly unknown[],
    mapper: (row: Row) => Record
  ): Promise<KnowledgeRepositoryListResult<Record>> {
    const result = await this.client.query<Row>(sql, params);
    return { items: result.rows.map(mapper) };
  }
}
