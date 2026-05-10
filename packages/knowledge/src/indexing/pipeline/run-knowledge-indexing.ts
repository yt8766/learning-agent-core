import type { Chunk, Document } from '../../contracts/indexing/schemas';
import type { KnowledgeVectorDocumentRecord } from '../../contracts/indexing/knowledge-vector-writer';
import type { KnowledgeRagMetric } from '../../contracts';
import type {
  KnowledgeChunk,
  KnowledgeSource,
  KnowledgeSourceType,
  KnowledgeTrustClass
} from '../../contracts/types/knowledge-retrieval.types';
import {
  buildKnowledgeRagEventId,
  tryFinishKnowledgeRagTrace,
  tryRecordKnowledgeRagEvent,
  tryStartKnowledgeRagTrace
} from '../../observability';

import {
  DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE,
  DEFAULT_KNOWLEDGE_INDEXING_CHUNK_OVERLAP,
  DEFAULT_KNOWLEDGE_INDEXING_CHUNK_SIZE,
  defaultKnowledgeShouldIndex
} from '../defaults/indexing-defaults';
import { FixedWindowChunker } from '../chunkers/fixed-window-chunker';
import type {
  KnowledgeIndexingContext,
  KnowledgeIndexingDiagnostics,
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
  const traceId = options.traceId ?? context.runId;

  const chunker = options.chunker ?? new FixedWindowChunker(context.chunkSize, context.chunkOverlap);
  const shouldIndex = options.shouldIndex ?? defaultKnowledgeShouldIndex;
  const warnings: string[] = [];

  tryStartKnowledgeRagTrace(options.observer, {
    traceId,
    runId: context.runId,
    operation: 'indexing.run',
    startedAt: context.startedAt,
    indexing: {
      sourceId: options.sourceConfig.sourceId
    }
  });
  tryRecordIndexingEvent(options, traceId, 'indexing.run.start', {
    sourceId: options.sourceConfig.sourceId
  });

  try {
    const loadedDocuments = await options.loader.load();
    const stages: KnowledgeIndexingDiagnostics['stages'] = [
      { stage: 'load', status: 'succeeded', outputCount: loadedDocuments.length }
    ];
    tryRecordIndexingEvent(options, traceId, 'indexing.load.complete', {
      sourceId: options.sourceConfig.sourceId,
      loadedDocumentCount: loadedDocuments.length
    });
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

    stages.push({
      stage: 'filter',
      status: 'succeeded',
      inputCount: loadedDocuments.length,
      outputCount: indexedCount,
      warningCount: warnings.length
    });
    stages.push({
      stage: 'chunk',
      status: 'succeeded',
      inputCount: indexedCount,
      outputCount: allChunks.length
    });
    tryRecordIndexingEvent(options, traceId, 'indexing.chunk.complete', {
      sourceId: options.sourceConfig.sourceId,
      loadedDocumentCount: loadedDocuments.length,
      chunkCount: allChunks.length
    });

    const vectorRecords = allChunks.map(toKnowledgeVectorDocumentRecord);
    const fulltextChunks = allChunks.map(chunk => toKnowledgeFulltextChunk(chunk, context.startedAt));
    stages.push({
      stage: 'embed',
      status: 'succeeded',
      inputCount: allChunks.length,
      outputCount: vectorRecords.length
    });
    tryRecordIndexingEvent(options, traceId, 'indexing.embed.complete', {
      sourceId: options.sourceConfig.sourceId,
      loadedDocumentCount: loadedDocuments.length,
      chunkCount: allChunks.length,
      embeddedChunkCount: vectorRecords.length
    });

    let fulltextChunkCount = 0;
    let vectorWriteCount = 0;
    let sourceWriteCount = 0;

    if (options.sourceIndex) {
      await Promise.all(
        [...sourceRecords.values()].map(async source => {
          await options.sourceIndex?.upsertKnowledgeSource(source);
          sourceWriteCount += 1;
        })
      );
    }

    for (let i = 0; i < allChunks.length; i += context.batchSize) {
      const vectorBatch = vectorRecords.slice(i, i + context.batchSize);
      const fulltextBatch = fulltextChunks.slice(i, i + context.batchSize);
      const fulltextIndex = options.fulltextIndex;

      await Promise.all([
        ...vectorBatch.map(async record => {
          await options.vectorIndex.upsertKnowledge(record);
          vectorWriteCount += 1;
        }),
        ...(fulltextIndex
          ? fulltextBatch.map(async chunk => {
              await fulltextIndex.upsertKnowledgeChunk(chunk);
              fulltextChunkCount += 1;
            })
          : [])
      ]);
    }

    stages.push({
      stage: 'store-vector',
      status: 'succeeded',
      inputCount: vectorRecords.length,
      outputCount: vectorWriteCount
    });
    stages.push({
      stage: 'store-fulltext',
      status: options.fulltextIndex ? 'succeeded' : 'skipped',
      inputCount: fulltextChunks.length,
      outputCount: fulltextChunkCount
    });
    stages.push({
      stage: 'store-source',
      status: options.sourceIndex ? 'succeeded' : 'skipped',
      inputCount: sourceRecords.size,
      outputCount: sourceWriteCount
    });

    const result: KnowledgeIndexingResult = {
      runId: context.runId,
      loadedDocumentCount: loadedDocuments.length,
      sourceCount: sourceRecords.size,
      indexedDocumentCount: indexedCount,
      skippedDocumentCount: skippedCount,
      chunkCount: allChunks.length,
      embeddedChunkCount: vectorRecords.length,
      fulltextChunkCount,
      warningCount: warnings.length,
      warnings,
      diagnostics: {
        stages,
        qualityGates: [
          createCountQualityGate({
            name: 'vector-records-match-chunks',
            stage: 'embed',
            expectedCount: allChunks.length,
            actualCount: vectorRecords.length
          }),
          createCountQualityGate({
            name: 'vector-writes-match-records',
            stage: 'store-vector',
            expectedCount: vectorRecords.length,
            actualCount: vectorWriteCount
          }),
          createCountQualityGate({
            name: 'fulltext-writes-match-chunks',
            stage: 'store-fulltext',
            expectedCount: allChunks.length,
            actualCount: fulltextChunkCount,
            skipped: !options.fulltextIndex
          })
        ]
      }
    };
    const indexingSnapshot = {
      sourceId: options.sourceConfig.sourceId,
      loadedDocumentCount: result.loadedDocumentCount,
      chunkCount: result.chunkCount,
      embeddedChunkCount: result.embeddedChunkCount,
      storedChunkCount: vectorWriteCount
    };

    tryRecordIndexingEvent(options, traceId, 'indexing.store.complete', indexingSnapshot);
    tryFinishKnowledgeRagTrace(options.observer, traceId, {
      status: 'succeeded',
      endedAt: new Date().toISOString(),
      indexing: indexingSnapshot,
      metrics: buildIndexingMetrics(traceId, result, vectorWriteCount),
      attributes: {
        qualityGates: (result.diagnostics?.qualityGates ?? []).map(gate => ({
          name: gate.name,
          stage: gate.stage,
          status: gate.status,
          expectedCount: gate.expectedCount ?? null,
          actualCount: gate.actualCount ?? null
        }))
      }
    });

    return result;
  } catch (error) {
    tryRecordKnowledgeRagEvent(options.observer, {
      eventId: buildKnowledgeRagEventId(traceId, 'indexing.run.fail'),
      traceId,
      name: 'indexing.run.fail',
      stage: 'indexing',
      occurredAt: new Date().toISOString(),
      error: toIndexingTraceError(error)
    });
    tryFinishKnowledgeRagTrace(options.observer, traceId, {
      status: 'failed',
      endedAt: new Date().toISOString()
    });
    throw error;
  }
}

function tryRecordIndexingEvent(
  options: KnowledgeIndexingRunOptions,
  traceId: string,
  name:
    | 'indexing.run.start'
    | 'indexing.load.complete'
    | 'indexing.chunk.complete'
    | 'indexing.embed.complete'
    | 'indexing.store.complete',
  indexing: {
    sourceId?: string;
    loadedDocumentCount?: number;
    chunkCount?: number;
    embeddedChunkCount?: number;
    storedChunkCount?: number;
  }
): void {
  tryRecordKnowledgeRagEvent(options.observer, {
    eventId: buildKnowledgeRagEventId(traceId, name),
    traceId,
    name,
    stage: 'indexing',
    occurredAt: new Date().toISOString(),
    indexing
  });
}

function buildIndexingMetrics(
  traceId: string,
  result: KnowledgeIndexingResult,
  storedChunkCount: number
): KnowledgeRagMetric[] {
  return [
    {
      traceId,
      name: 'indexing.loaded_document_count',
      value: result.loadedDocumentCount,
      unit: 'count',
      stage: 'indexing'
    },
    { traceId, name: 'indexing.chunk_count', value: result.chunkCount, unit: 'count', stage: 'indexing' },
    {
      traceId,
      name: 'indexing.embedded_chunk_count',
      value: result.embeddedChunkCount,
      unit: 'count',
      stage: 'indexing'
    },
    {
      traceId,
      name: 'indexing.stored_chunk_count',
      value: storedChunkCount,
      unit: 'count',
      stage: 'indexing'
    }
  ];
}

function toIndexingTraceError(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
  stage: 'indexing';
} {
  return {
    code: error instanceof Error ? error.name || 'Error' : 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown knowledge indexing runtime error',
    retryable: false,
    stage: 'indexing'
  };
}

function createCountQualityGate(input: {
  name: string;
  stage: KnowledgeIndexingDiagnostics['qualityGates'][number]['stage'];
  expectedCount: number;
  actualCount: number;
  skipped?: boolean;
}): KnowledgeIndexingDiagnostics['qualityGates'][number] {
  if (input.skipped) {
    return {
      name: input.name,
      stage: input.stage,
      status: 'skipped',
      expectedCount: input.expectedCount,
      actualCount: input.actualCount,
      message: 'Writer was not provided for this indexing run.'
    };
  }

  const passed = input.expectedCount === input.actualCount;
  return {
    name: input.name,
    stage: input.stage,
    status: passed ? 'passed' : 'failed',
    expectedCount: input.expectedCount,
    actualCount: input.actualCount,
    ...(passed ? {} : { message: `Expected ${input.expectedCount} records but wrote ${input.actualCount}.` })
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
    sourceType: resolveSourceType(chunk.metadata, 'repo-docs'),
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
