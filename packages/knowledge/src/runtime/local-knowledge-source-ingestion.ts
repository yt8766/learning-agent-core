import type { KnowledgeChunk, KnowledgeSource } from '../contracts/types/knowledge-retrieval.types';
import type {
  KnowledgeChunkRecord,
  KnowledgeIngestionReceiptRecord,
  KnowledgeSourceRecord
} from '../contracts/types/knowledge-runtime.types';
import type { KnowledgeVectorIndexWriter } from '@agent/memory';

import { createKnowledgeSourceIngestionLoader, type KnowledgeSourceIngestionPayload } from '../indexing';
import { runKnowledgeIndexing } from '../indexing/pipeline/run-knowledge-indexing';
import {
  ensureKnowledgeDirectories,
  estimateTokenCount,
  hashText,
  readKnowledgeSnapshot,
  writeKnowledgeSnapshot
} from './local-knowledge-store.helpers';

export interface RuntimeKnowledgeSourceIngestionSettings {
  workspaceRoot: string;
  knowledgeRoot: string;
}

export async function ingestKnowledgeSourcePayloads(
  settings: RuntimeKnowledgeSourceIngestionSettings,
  payloads: readonly KnowledgeSourceIngestionPayload[],
  vectorIndex: KnowledgeVectorIndexWriter
) {
  await ensureKnowledgeDirectories(settings);
  const existing = await readKnowledgeSnapshot(settings);
  const sources: KnowledgeSource[] = [];
  const chunks: KnowledgeChunk[] = [];

  const result = await runKnowledgeIndexing({
    loader: createKnowledgeSourceIngestionLoader(payloads),
    vectorIndex,
    sourceIndex: {
      async upsertKnowledgeSource(source) {
        sources.push(source);
      }
    },
    fulltextIndex: {
      async upsertKnowledgeChunk(chunk) {
        chunks.push(chunk);
      }
    },
    sourceConfig: {
      sourceId: 'runtime-ingestion',
      sourceType: 'workspace-docs',
      trustClass: 'internal'
    }
  });

  const now = new Date().toISOString();
  const receiptRecords = toReceiptRecords(sources, chunks, now);
  const nextSources = mergeById(
    existing.sources,
    sources.map(source => toSourceRecord(source, now, receiptRecords))
  );
  const nextChunks = mergeById(
    existing.chunks,
    chunks.map(chunk => toChunkRecord(chunk, now, receiptRecords))
  );

  await writeKnowledgeSnapshot(settings, {
    stores: existing.stores,
    sources: nextSources,
    chunks: nextChunks,
    embeddings: existing.embeddings,
    receipts: mergeById(existing.receipts, receiptRecords)
  });

  return result;
}

function toSourceRecord(
  source: KnowledgeSource,
  now: string,
  receipts: KnowledgeIngestionReceiptRecord[]
): KnowledgeSourceRecord {
  const receipt = receipts.find(item => item.sourceId === source.id);
  return {
    id: source.id,
    store: 'cangjing',
    sourceType: source.sourceType,
    uri: source.uri,
    title: source.title,
    trustClass: source.trustClass,
    receiptId: receipt?.id,
    version: source.version ?? receipt?.version,
    lastIngestedAt: now,
    createdAt: now,
    updatedAt: source.updatedAt
  };
}

function toChunkRecord(
  chunk: KnowledgeChunk,
  now: string,
  receipts: KnowledgeIngestionReceiptRecord[]
): KnowledgeChunkRecord {
  const receipt = receipts.find(item => item.sourceId === chunk.sourceId);
  return {
    id: chunk.id,
    store: 'cangjing',
    sourceId: chunk.sourceId,
    documentId: chunk.documentId,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    tokenCount: chunk.tokenCount ?? estimateTokenCount(chunk.content),
    searchable: chunk.searchable,
    metadata: chunk.metadata,
    receiptId: receipt?.id,
    version: receipt?.version,
    createdAt: now,
    updatedAt: chunk.updatedAt
  };
}

function toReceiptRecords(
  sources: KnowledgeSource[],
  chunks: KnowledgeChunk[],
  now: string
): KnowledgeIngestionReceiptRecord[] {
  return sources.map(source => {
    const sourceChunks = chunks.filter(chunk => chunk.sourceId === source.id);
    const version = source.version ?? `runtime:${hashText(`${source.id}:${source.updatedAt}:${sourceChunks.length}`)}`;
    return {
      id: `receipt_${hashText(`${source.id}:${version}`)}`,
      store: 'cangjing',
      sourceId: source.id,
      sourceType: source.sourceType,
      version,
      status: sourceChunks.length > 0 ? 'completed' : 'failed',
      documentCount: 1,
      chunkCount: sourceChunks.length,
      embeddedChunkCount: sourceChunks.length,
      skippedChunkCount: 0,
      failureReason: sourceChunks.length > 0 ? undefined : 'no_indexed_chunks',
      createdAt: now,
      updatedAt: now
    };
  });
}

function mergeById<T extends { id: string }>(existing: readonly T[], updates: readonly T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of existing) merged.set(item.id, item);
  for (const item of updates) merged.set(item.id, item);
  return [...merged.values()];
}
