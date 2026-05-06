import type {
  Chunk,
  Document,
  KnowledgeChunk,
  KnowledgeSource,
  KnowledgeSourceType,
  KnowledgeTrustClass
} from '../../index';
import type { KnowledgeVectorDocumentRecord } from '@agent/memory';

import {
  DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE,
  DEFAULT_KNOWLEDGE_INDEXING_CHUNK_OVERLAP,
  DEFAULT_KNOWLEDGE_INDEXING_CHUNK_SIZE,
  defaultKnowledgeShouldIndex
} from '../defaults/indexing-defaults';
import { FixedWindowChunker } from '../chunkers/fixed-window-chunker';
import type {
  KnowledgeIndexingContext,
  KnowledgeIndexingResult,
  KnowledgeIndexingRunOptions
} from '../types/indexing.types';

export async function runKnowledgeIndexing(options: KnowledgeIndexingRunOptions): Promise<KnowledgeIndexingResult> {
  const context: KnowledgeIndexingContext = {
    runId: createRunId(),
    startedAt: new Date().toISOString(),
    chunkSize: options.chunkSize ?? DEFAULT_KNOWLEDGE_INDEXING_CHUNK_SIZE,
    chunkOverlap: options.chunkOverlap ?? DEFAULT_KNOWLEDGE_INDEXING_CHUNK_OVERLAP,
    batchSize: options.batchSize ?? DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE
  };

  const chunker = options.chunker ?? new FixedWindowChunker(context.chunkSize, context.chunkOverlap);
  const shouldIndex = options.shouldIndex ?? defaultKnowledgeShouldIndex;
  const warnings: string[] = [];

  const loadedDocuments = await options.loader.load();
  let indexedCount = 0;
  let skippedCount = 0;
  const allChunks: Chunk[] = [];
  const sourceRecords = new Map<string, KnowledgeSource>();

  for (const doc of loadedDocuments) {
    if (!(await shouldIndex(doc))) {
      skippedCount += 1;
      const warning = `Skipped knowledge document ${doc.id}.`;
      warnings.push(warning);
      await options.onWarning?.(warning);
      continue;
    }

    indexedCount += 1;
    const sourceRecord = toKnowledgeSource(doc, options.sourceConfig, context.startedAt);
    sourceRecords.set(sourceRecord.id, sourceRecord);
    const docChunks = await chunker.chunk(doc);

    for (const chunk of docChunks) {
      allChunks.push({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          sourceId: resolveField(doc.metadata, 'sourceId') ?? options.sourceConfig.sourceId,
          documentId: doc.id,
          title: resolveField(doc.metadata, 'title') ?? doc.id,
          uri: resolveField(doc.metadata, 'uri') ?? doc.id,
          sourceType: resolveSourceType(doc.metadata, options.sourceConfig.sourceType),
          trustClass: resolveTrustClass(doc.metadata, options.sourceConfig.trustClass),
          content: chunk.content
        }
      });
    }
  }

  const vectorRecords = allChunks.map(toKnowledgeVectorDocumentRecord);
  const fulltextChunks = allChunks.map(chunk => toKnowledgeFulltextChunk(chunk, context.startedAt));
  let fulltextChunkCount = 0;

  if (options.sourceIndex) {
    await Promise.all([...sourceRecords.values()].map(source => options.sourceIndex?.upsertKnowledgeSource(source)));
  }

  for (let i = 0; i < allChunks.length; i += context.batchSize) {
    const vectorBatch = vectorRecords.slice(i, i + context.batchSize);
    const fulltextBatch = fulltextChunks.slice(i, i + context.batchSize);
    const fulltextIndex = options.fulltextIndex;

    await Promise.all([
      ...vectorBatch.map(record => options.vectorIndex.upsertKnowledge(record)),
      ...(fulltextIndex ? fulltextBatch.map(chunk => fulltextIndex.upsertKnowledgeChunk(chunk)) : [])
    ]);

    if (fulltextIndex) {
      fulltextChunkCount += fulltextBatch.length;
    }
  }

  return {
    runId: context.runId,
    loadedDocumentCount: loadedDocuments.length,
    sourceCount: sourceRecords.size,
    indexedDocumentCount: indexedCount,
    skippedDocumentCount: skippedCount,
    chunkCount: allChunks.length,
    embeddedChunkCount: vectorRecords.length,
    fulltextChunkCount,
    warningCount: warnings.length,
    warnings
  };
}

function toKnowledgeSource(
  doc: Document,
  sourceConfig: KnowledgeIndexingRunOptions['sourceConfig'],
  updatedAt: string
): KnowledgeSource {
  const sourceId = resolveField(doc.metadata, 'sourceId') ?? sourceConfig.sourceId;
  return {
    id: sourceId,
    sourceType: resolveSourceType(doc.metadata, sourceConfig.sourceType),
    uri: resolveField(doc.metadata, 'uri') ?? doc.id,
    title: resolveField(doc.metadata, 'title') ?? doc.id,
    trustClass: resolveTrustClass(doc.metadata, sourceConfig.trustClass),
    version: resolveField(doc.metadata, 'version'),
    updatedAt
  };
}

function toKnowledgeVectorDocumentRecord(chunk: Chunk): KnowledgeVectorDocumentRecord {
  const documentId = resolveField(chunk.metadata, 'documentId') ?? chunk.sourceDocumentId;
  return {
    id: chunk.id,
    namespace: 'knowledge',
    sourceId: resolveField(chunk.metadata, 'sourceId') ?? documentId,
    documentId,
    chunkId: chunk.id,
    uri: resolveField(chunk.metadata, 'uri') ?? documentId,
    title: resolveField(chunk.metadata, 'title') ?? documentId,
    sourceType: resolveField(chunk.metadata, 'sourceType') ?? 'repo-docs',
    content: chunk.content,
    searchable: true
  };
}

function toKnowledgeFulltextChunk(chunk: Chunk, updatedAt: string): KnowledgeChunk {
  const documentId = resolveField(chunk.metadata, 'documentId') ?? chunk.sourceDocumentId;
  return {
    id: chunk.id,
    sourceId: resolveField(chunk.metadata, 'sourceId') ?? documentId,
    documentId,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    searchable: true,
    metadata: chunk.metadata,
    updatedAt
  };
}

function resolveField(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function resolveSourceType(metadata: Record<string, unknown>, fallback: KnowledgeSourceType): KnowledgeSourceType {
  const value = resolveField(metadata, 'sourceType');
  return isKnowledgeSourceType(value) ? value : fallback;
}

function resolveTrustClass(metadata: Record<string, unknown>, fallback: KnowledgeTrustClass): KnowledgeTrustClass {
  const value = resolveField(metadata, 'trustClass');
  return isKnowledgeTrustClass(value) ? value : fallback;
}

function isKnowledgeSourceType(value: unknown): value is KnowledgeSourceType {
  return (
    value === 'workspace-docs' ||
    value === 'repo-docs' ||
    value === 'connector-manifest' ||
    value === 'catalog-sync' ||
    value === 'user-upload' ||
    value === 'web-curated'
  );
}

function isKnowledgeTrustClass(value: unknown): value is KnowledgeTrustClass {
  return (
    value === 'official' ||
    value === 'curated' ||
    value === 'community' ||
    value === 'unverified' ||
    value === 'internal'
  );
}

function createRunId(): string {
  return `knowledge-indexing-${Date.now()}`;
}
