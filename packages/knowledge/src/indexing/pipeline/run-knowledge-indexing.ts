import type { Chunk, Vector } from '@agent/core';

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

  const allVectors: Vector[] = [];
  for (let i = 0; i < allChunks.length; i += context.batchSize) {
    const batch = allChunks.slice(i, i + context.batchSize);
    const batchVectors = await options.embedder.embed(batch);
    allVectors.push(...batchVectors);
  }

  if (allVectors.length > 0) {
    await options.vectorStore.upsert(allVectors);
  }

  return {
    runId: context.runId,
    loadedDocumentCount: loadedDocuments.length,
    indexedDocumentCount: indexedCount,
    skippedDocumentCount: skippedCount,
    chunkCount: allChunks.length,
    embeddedChunkCount: allVectors.length,
    warningCount: warnings.length,
    warnings
  };
}

function resolveField(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}

function createRunId(): string {
  return `knowledge-indexing-${Date.now()}`;
}
