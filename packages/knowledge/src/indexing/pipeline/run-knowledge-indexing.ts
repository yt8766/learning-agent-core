import type { KnowledgeSource } from '@agent/core';

import {
  DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE,
  DEFAULT_KNOWLEDGE_INDEXING_CHUNK_OVERLAP,
  DEFAULT_KNOWLEDGE_INDEXING_CHUNK_SIZE,
  defaultKnowledgeMetadata,
  defaultKnowledgeShouldIndex
} from '../defaults/indexing-defaults';
import { FixedWindowKnowledgeChunker } from '../chunkers/fixed-window-knowledge-chunker';
import type {
  KnowledgeChunkEnvelope,
  KnowledgeIndexingContext,
  KnowledgeIndexingDocument,
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

  const chunker = options.chunker ?? new FixedWindowKnowledgeChunker();
  const shouldIndex = options.shouldIndex ?? defaultKnowledgeShouldIndex;
  const warnings: string[] = [];

  const loadedDocuments = await options.loader.load(context);
  const indexedDocuments: KnowledgeIndexingDocument[] = [];
  const skippedDocuments: KnowledgeIndexingDocument[] = [];
  const sources = new Map<string, KnowledgeSource>();
  const envelopes: KnowledgeChunkEnvelope[] = [];

  for (const rawDocument of loadedDocuments) {
    let document = rawDocument;
    for (const transformer of options.transformers ?? []) {
      document = await transformer.transform(document, context);
    }

    if (!(await shouldIndex(document, context))) {
      skippedDocuments.push(document);
      const warning = `Skipped knowledge document ${document.id}.`;
      warnings.push(warning);
      await options.onWarning?.(warning, context);
      continue;
    }

    indexedDocuments.push(document);
    const source = toKnowledgeSource(document);
    sources.set(source.id, source);
    const chunks = await chunker.chunk({ source, document, context });

    for (const chunk of chunks) {
      const metadata =
        (await options.metadataBuilder?.({ source, document, chunk, context })) ?? defaultKnowledgeMetadata();
      envelopes.push({
        source,
        document,
        chunk,
        metadata
      });
    }
  }

  const embeddings = [];
  for (let index = 0; index < envelopes.length; index += context.batchSize) {
    const batch = envelopes.slice(index, index + context.batchSize);
    const batchEmbeddings = await options.embedder.embed({ chunks: batch, context });
    embeddings.push(...batchEmbeddings);
  }

  await options.writer.write({
    sources: [...sources.values()],
    chunks: envelopes,
    embeddings,
    context
  });

  return {
    runId: context.runId,
    loadedDocumentCount: loadedDocuments.length,
    indexedDocumentCount: indexedDocuments.length,
    skippedDocumentCount: skippedDocuments.length,
    chunkCount: envelopes.length,
    embeddedChunkCount: embeddings.length,
    warningCount: warnings.length,
    warnings
  };
}

function toKnowledgeSource(document: KnowledgeIndexingDocument): KnowledgeSource {
  return {
    id: document.sourceId,
    sourceType: document.sourceType,
    uri: document.uri,
    title: document.title,
    trustClass: document.trustClass,
    updatedAt: document.updatedAt
  };
}

function createRunId(): string {
  return `knowledge-indexing-${Date.now()}`;
}
