import type {
  JsonObject,
  KnowledgeSdkVectorRecord,
  KnowledgeSdkVectorSearchHit,
  KnowledgeSdkVectorSearchInput,
  KnowledgeSdkVectorUpsertInput
} from '../../index';

import { AdapterError } from '../shared/errors/adapter-error';
import type {
  SupabasePgVectorChunkInput,
  SupabasePgVectorSearchFilters,
  SupabasePgVectorSearchInput,
  SupabasePgVectorSearchMatch,
  SupabasePgVectorUpsertInput
} from './supabase-pgvector-store.adapter';

const ADAPTER_NAME = 'SupabasePgVectorStoreAdapter';

interface SupabasePgVectorRow {
  chunk_id?: unknown;
  document_id?: unknown;
  content?: unknown;
  text?: unknown;
  score?: unknown;
  metadata?: unknown;
}

interface NormalizedUpsertGroup {
  tenantId?: string;
  knowledgeBaseId: string;
  documentId: string;
  chunks: SupabasePgVectorChunkInput[];
}

interface AdapterDefaults {
  tenantId?: string;
  knowledgeBaseId?: string;
  documentId?: string;
}

export function withOptionalTenant(tenantId: string | undefined): Record<string, unknown> {
  return tenantId ? { tenant_id: tenantId } : {};
}

export function mapFilters(filters: SupabasePgVectorSearchFilters | undefined): Record<string, unknown> {
  if (!filters) return {};

  return {
    ...(filters.documentIds ? { document_ids: filters.documentIds } : {}),
    ...(filters.tags ? { tags: filters.tags } : {}),
    ...(filters.metadata ? { metadata: filters.metadata } : {})
  };
}

export function normalizeSearchInput(
  input: KnowledgeSdkVectorSearchInput | SupabasePgVectorSearchInput,
  defaultTenantId: string | undefined,
  defaultKnowledgeBaseId: string | undefined
): Omit<SupabasePgVectorSearchInput, 'embedding' | 'topK'> {
  if (isSupabaseSearchInput(input)) {
    return {
      tenantId: input.tenantId ?? defaultTenantId,
      knowledgeBaseId: input.knowledgeBaseId,
      query: input.query,
      filters: input.filters
    };
  }

  const filters = input.filters;
  const knowledgeBaseId = getStringField(filters, 'knowledgeBaseId') ?? defaultKnowledgeBaseId;
  if (!knowledgeBaseId) {
    throw toAdapterError('SDK search requires knowledgeBaseId in filters or adapter options', input);
  }

  return {
    tenantId: getStringField(filters, 'tenantId') ?? defaultTenantId,
    knowledgeBaseId,
    query: getStringField(filters, 'query'),
    filters: {
      documentIds: getDocumentIds(filters),
      tags: getStringArrayField(filters, 'tags'),
      metadata: getRecordField(filters, 'metadata')
    }
  };
}

export function mapSearchRow(row: unknown): SupabasePgVectorSearchMatch {
  if (!isRecord(row)) {
    throw toAdapterError('search row must be a record', row);
  }

  const searchRow = row as SupabasePgVectorRow;
  const chunkId = requiredNonEmptyString(searchRow.chunk_id, 'search row chunk_id');
  const documentId = requiredNonEmptyString(searchRow.document_id, 'search row document_id');
  const text = requiredNonEmptyString(searchRow.content ?? searchRow.text, 'search row text/content');
  const score = requiredNumber(searchRow.score, 'search row score');

  return {
    chunkId,
    documentId,
    text,
    score,
    ...mapSearchMetadata(searchRow.metadata)
  };
}

export function mapSearchMatchToSdkHit(match: SupabasePgVectorSearchMatch): KnowledgeSdkVectorSearchHit {
  return {
    id: match.chunkId,
    score: match.score,
    content: match.text,
    ...(match.metadata ? { metadata: match.metadata } : {})
  };
}

export function groupSdkRecords(
  records: KnowledgeSdkVectorRecord[],
  defaults: AdapterDefaults
): NormalizedUpsertGroup[] {
  const groups = new Map<string, NormalizedUpsertGroup>();

  for (const record of records) {
    const knowledgeBaseId = getStringField(record.metadata, 'knowledgeBaseId') ?? defaults.knowledgeBaseId;
    const documentId = getStringField(record.metadata, 'documentId') ?? defaults.documentId;

    if (!knowledgeBaseId) {
      throw toAdapterError('SDK upsert record requires knowledgeBaseId in metadata or adapter options', record);
    }
    if (!documentId) {
      throw toAdapterError('SDK upsert record requires documentId in metadata or adapter options', record);
    }

    const tenantId = getStringField(record.metadata, 'tenantId') ?? defaults.tenantId;
    const groupKey = JSON.stringify([tenantId ?? null, knowledgeBaseId, documentId]);
    const group = groups.get(groupKey) ?? {
      tenantId,
      knowledgeBaseId,
      documentId,
      chunks: []
    };

    group.chunks.push({
      id: record.id,
      text: record.content ?? '',
      embedding: record.embedding,
      metadata: record.metadata as JsonObject | undefined
    });
    groups.set(groupKey, group);
  }

  return Array.from(groups.values());
}

export function validateBatchEmbeddings(chunks: SupabasePgVectorChunkInput[]): void {
  const firstChunk = chunks[0];
  if (!firstChunk) {
    return;
  }

  validateVector(firstChunk.embedding, `chunk ${firstChunk.id} embedding`);
  const expectedDimensions = firstChunk.embedding.length;

  for (const chunk of chunks.slice(1)) {
    validateVector(chunk.embedding, `chunk ${chunk.id} embedding`);
    if (chunk.embedding.length !== expectedDimensions) {
      throw toAdapterError('upsert chunk embeddings must have consistent dimensions', {
        chunkId: chunk.id,
        expectedDimensions,
        actualDimensions: chunk.embedding.length
      });
    }
  }
}

export function validateVector(value: unknown, label: string): void {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(item => typeof item !== 'number' || !Number.isFinite(item))
  ) {
    throw toAdapterError(`${label} must be a non-empty finite number array`, value);
  }
}

export function requiredNonNegativeIntegerField(data: unknown, field: string, label: string): number {
  if (!isRecord(data)) {
    throw toAdapterError(`${label} data must be a record`, data);
  }

  return requiredNonNegativeInteger(data[field], `${label} ${field}`);
}

export function toAdapterError(message: string, cause: unknown): AdapterError {
  return new AdapterError(ADAPTER_NAME, message, cause);
}

export function isKnowledgeSdkUpsertInput(
  input: KnowledgeSdkVectorUpsertInput | SupabasePgVectorUpsertInput
): input is KnowledgeSdkVectorUpsertInput {
  return 'records' in input;
}

export function getStringField(source: unknown, field: string): string | undefined {
  if (!isRecord(source)) {
    return undefined;
  }
  const value = source[field];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function getSingleId(ids: string[] | undefined): string | undefined {
  return ids?.length === 1 ? ids[0] : undefined;
}

function mapSearchMetadata(value: unknown): { metadata?: JsonObject } {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw toAdapterError('search row metadata must be a record when present', value);
  }

  return { metadata: value as JsonObject };
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw toAdapterError(`${label} must be a finite number`, value);
  }

  return value;
}

function requiredNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw toAdapterError(`${label} must be a non-negative integer`, value);
  }

  return value;
}

function requiredNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw toAdapterError(`${label} must be a non-empty string`, value);
  }

  return value;
}

function isSupabaseSearchInput(
  input: KnowledgeSdkVectorSearchInput | SupabasePgVectorSearchInput
): input is SupabasePgVectorSearchInput {
  return 'knowledgeBaseId' in input;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringArrayField(source: unknown, field: string): string[] | undefined {
  if (!isRecord(source)) {
    return undefined;
  }
  const value = source[field];

  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : undefined;
}

function getRecordField(source: unknown, field: string): JsonObject | undefined {
  if (!isRecord(source)) {
    return undefined;
  }
  const value = source[field];

  return isRecord(value) ? (value as JsonObject) : undefined;
}

function getDocumentIds(filters: unknown): string[] | undefined {
  const documentIds = getStringArrayField(filters, 'documentIds');
  if (documentIds) {
    return documentIds;
  }

  const documentId = getStringField(filters, 'documentId');
  return documentId ? [documentId] : undefined;
}
