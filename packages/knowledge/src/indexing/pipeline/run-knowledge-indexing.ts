import type { Chunk } from '@agent/knowledge';
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

  for (const doc of loadedDocuments) {
    if (!(await shouldIndex(doc))) {
      skippedCount += 1;
      const warning = `Skipped knowledge document ${doc.id}.`;
      warnings.push(warning);
      await options.onWarning?.(warning);
      continue;
    }

    indexedCount += 1;
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
          sourceType: resolveField(doc.metadata, 'sourceType') ?? options.sourceConfig.sourceType,
          trustClass: resolveField(doc.metadata, 'trustClass') ?? options.sourceConfig.trustClass,
          content: chunk.content
        }
      });
    }
  }

  const vectorRecords = allChunks.map(toKnowledgeVectorDocumentRecord);
  for (let i = 0; i < allChunks.length; i += context.batchSize) {
    const batch = vectorRecords.slice(i, i + context.batchSize);
    await Promise.all(batch.map(record => options.vectorIndex.upsertKnowledge(record)));
  }

  return {
    runId: context.runId,
    loadedDocumentCount: loadedDocuments.length,
    indexedDocumentCount: indexedCount,
    skippedDocumentCount: skippedCount,
    chunkCount: allChunks.length,
    embeddedChunkCount: vectorRecords.length,
    warningCount: warnings.length,
    warnings
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

function resolveField(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function createRunId(): string {
  return `knowledge-indexing-${Date.now()}`;
}
