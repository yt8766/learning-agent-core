import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DefaultKnowledgeSearchService,
  DefaultQueryNormalizer,
  DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE,
  DefaultPostRetrievalDiversifier,
  DefaultPostRetrievalFilter,
  DefaultPostRetrievalRanker,
  HybridRetrievalEngine,
  KnowledgeChatRoutingError,
  createKnowledgeSearchServiceRetriever,
  InMemoryKnowledgeChunkRepository,
  InMemoryKnowledgeSourceRepository,
  RrfFusionStrategy,
  SmallToBigContextExpander,
  resolveKnowledgeChatRoute,
  ingestLocalKnowledge,
  LocalKnowledgeFacade,
  listKnowledgeArtifacts,
  readKnowledgeOverview,
  RetrievalRequestSchema,
  HybridKnowledgeSearchProductionConfigSchema,
  KnowledgeBaseHealthSchema,
  KnowledgeBaseHealthStatusSchema,
  KnowledgeErrorResponseSchema,
  KnowledgeEvalCaseSchema,
  KnowledgeEvalRunResultSchema,
  KnowledgeIngestionJobProjectionSchema,
  KnowledgeIngestionJobStatusSchema,
  KnowledgeIngestionStageSchema,
  KnowledgeProviderHealthStatusSchema,
  KnowledgeRagDiagnosticsSchema,
  KnowledgeRagRouteReasonSchema,
  KnowledgeRagRouteSchema,
  KnowledgeRetrievalModeSchema,
  KnowledgeTraceOperationSchema,
  KnowledgeTraceSpanStatusSchema,
  KnowledgeVectorDocumentRecordSchema,
  KnowledgeWorkbenchSpanNameSchema,
  KnowledgeWorkbenchTraceStatusSchema,
  buildCatalogSyncKnowledgePayload,
  buildConnectorSyncKnowledgePayload,
  buildUserUploadKnowledgePayload,
  buildWebCuratedKnowledgePayload,
  createKnowledgeSourceIngestionLoader,
  createInMemoryKnowledgeRagObserver,
  ingestKnowledgeSourcePayloads,
  runKnowledgeIndexing
} from '../src/index';
import type {
  KnowledgeBaseHealth,
  KnowledgeBaseHealthStatus,
  KnowledgeErrorResponse,
  KnowledgeEvalCase,
  KnowledgeEvalRunResult,
  KnowledgeIngestionJobProjection,
  KnowledgeIngestionJobStatus,
  KnowledgeIngestionStage,
  KnowledgeProviderHealthStatus,
  KnowledgeRagDiagnostics,
  KnowledgeRagRoute,
  KnowledgeRagRouteReason,
  KnowledgeRetrievalMode,
  KnowledgeTraceOperation,
  KnowledgeTraceSpanStatus,
  KnowledgeVectorDocumentRecord,
  KnowledgeVectorIndexWriter,
  KnowledgeWorkbenchSpanName,
  KnowledgeWorkbenchTraceStatus
} from '../src/index';
import * as rootExports from '../src/index';
import * as contractExports from '../src/contracts/knowledge-facade';
import * as indexingExports from '../src/indexing';
import * as observabilityExports from '../src/observability';
import * as chunkRepositoryExports from '../src/repositories/knowledge-chunk.repository';
import * as sourceRepositoryExports from '../src/repositories/knowledge-source.repository';
import * as retrievalExports from '../src/retrieval/knowledge-search-service';
import * as runtimeExports from '../src/runtime/local-knowledge-facade';
import * as localKnowledgeStoreExports from '../src/runtime/local-knowledge-store';

describe('@agent/knowledge root exports', () => {
  it('re-exports runtime-facing hosts from the canonical domain directories', () => {
    expect(InMemoryKnowledgeSourceRepository).toBe(sourceRepositoryExports.InMemoryKnowledgeSourceRepository);
    expect(InMemoryKnowledgeChunkRepository).toBe(chunkRepositoryExports.InMemoryKnowledgeChunkRepository);
    expect(DefaultKnowledgeSearchService).toBe(retrievalExports.DefaultKnowledgeSearchService);
    expect(DefaultQueryNormalizer).toBe(rootExports.DefaultQueryNormalizer);
    expect(LocalKnowledgeFacade).toBe(runtimeExports.LocalKnowledgeFacade);
    expect(ingestLocalKnowledge).toBe(localKnowledgeStoreExports.ingestLocalKnowledge);
    expect(readKnowledgeOverview).toBe(localKnowledgeStoreExports.readKnowledgeOverview);
    expect(listKnowledgeArtifacts).toBe(localKnowledgeStoreExports.listKnowledgeArtifacts);
  });

  it('re-exports stable schema-first contracts from the knowledge package host', () => {
    expect(rootExports.RetrievalRequestSchema).toBe(RetrievalRequestSchema);
    expect(RetrievalRequestSchema.safeParse({ query: 'RAG 是什么' }).success).toBe(true);
    expect(rootExports.HybridKnowledgeSearchProductionConfigSchema).toBe(HybridKnowledgeSearchProductionConfigSchema);
  });

  it('re-exports trustworthy RAG workbench schemas and types from the root entrypoint', () => {
    expect(rootExports.KnowledgeBaseHealthSchema).toBe(KnowledgeBaseHealthSchema);
    expect(rootExports.KnowledgeBaseHealthStatusSchema).toBe(KnowledgeBaseHealthStatusSchema);
    expect(rootExports.KnowledgeProviderHealthStatusSchema).toBe(KnowledgeProviderHealthStatusSchema);
    expect(rootExports.KnowledgeIngestionJobProjectionSchema).toBe(KnowledgeIngestionJobProjectionSchema);
    expect(rootExports.KnowledgeIngestionStageSchema).toBe(KnowledgeIngestionStageSchema);
    expect(rootExports.KnowledgeIngestionJobStatusSchema).toBe(KnowledgeIngestionJobStatusSchema);
    expect(rootExports.KnowledgeErrorResponseSchema).toBe(KnowledgeErrorResponseSchema);
    expect(rootExports.KnowledgeEvalCaseSchema).toBe(KnowledgeEvalCaseSchema);
    expect(rootExports.KnowledgeEvalRunResultSchema).toBe(KnowledgeEvalRunResultSchema);
    expect(rootExports.KnowledgeRagRouteSchema).toBe(KnowledgeRagRouteSchema);
    expect(rootExports.KnowledgeRagRouteReasonSchema).toBe(KnowledgeRagRouteReasonSchema);
    expect(rootExports.KnowledgeRagDiagnosticsSchema).toBe(KnowledgeRagDiagnosticsSchema);
    expect(rootExports.KnowledgeRetrievalModeSchema).toBe(KnowledgeRetrievalModeSchema);
    expect(rootExports.KnowledgeTraceOperationSchema).toBe(KnowledgeTraceOperationSchema);
    expect(rootExports.KnowledgeWorkbenchSpanNameSchema).toBe(KnowledgeWorkbenchSpanNameSchema);
    expect(rootExports.KnowledgeWorkbenchTraceStatusSchema).toBe(KnowledgeWorkbenchTraceStatusSchema);
    expect(rootExports.KnowledgeTraceSpanStatusSchema).toBe(KnowledgeTraceSpanStatusSchema);
    expect(
      KnowledgeBaseHealthSchema.safeParse({
        knowledgeBaseId: 'kb-1',
        status: 'ready',
        documentCount: 1,
        searchableDocumentCount: 1,
        chunkCount: 3,
        failedJobCount: 0,
        providerHealth: {
          embedding: 'ok',
          vector: 'ok',
          keyword: 'ok',
          generation: 'ok'
        }
      }).success
    ).toBe(true);

    const typeSmoke: {
      health: KnowledgeBaseHealth;
      job: KnowledgeIngestionJobProjection;
      error: KnowledgeErrorResponse;
      evalCase: KnowledgeEvalCase;
      evalResult: KnowledgeEvalRunResult;
      route: KnowledgeRagRoute;
      diagnostics: KnowledgeRagDiagnostics;
      operation: KnowledgeTraceOperation;
      spanName: KnowledgeWorkbenchSpanName;
      healthStatus: KnowledgeBaseHealthStatus;
      providerStatus: KnowledgeProviderHealthStatus;
      ingestionStage: KnowledgeIngestionStage;
      ingestionStatus: KnowledgeIngestionJobStatus;
      routeReason: KnowledgeRagRouteReason;
      retrievalMode: KnowledgeRetrievalMode;
      workbenchTraceStatus: KnowledgeWorkbenchTraceStatus;
      traceSpanStatus: KnowledgeTraceSpanStatus;
    } = {
      health: KnowledgeBaseHealthSchema.parse({
        knowledgeBaseId: 'kb-type',
        status: 'empty',
        documentCount: 0,
        searchableDocumentCount: 0,
        chunkCount: 0,
        failedJobCount: 0,
        providerHealth: {
          embedding: 'unconfigured',
          vector: 'unconfigured',
          keyword: 'unconfigured',
          generation: 'unconfigured'
        }
      }),
      job: KnowledgeIngestionJobProjectionSchema.parse({
        id: 'job-type',
        documentId: 'doc-type',
        stage: 'uploaded',
        status: 'queued',
        progress: { percent: 0 },
        attempts: 1,
        createdAt: '2026-05-03T08:00:00.000Z',
        updatedAt: '2026-05-03T08:00:00.000Z'
      }),
      error: KnowledgeErrorResponseSchema.parse({
        code: 'KNOWLEDGE_PROVIDER_UNAVAILABLE',
        message: 'Embedding provider is unavailable.',
        retryable: true
      }),
      evalCase: KnowledgeEvalCaseSchema.parse({
        id: 'case-type',
        datasetId: 'dataset-type',
        question: '如何验证根入口类型导出？'
      }),
      evalResult: KnowledgeEvalRunResultSchema.parse({
        runId: 'run-type',
        caseId: 'case-type',
        answerId: 'answer-type',
        metrics: { citationAccuracy: 1 },
        traceId: 'trace-type'
      }),
      route: KnowledgeRagRouteSchema.parse({
        selectedKnowledgeBaseIds: ['kb-type'],
        reason: 'fallback-all'
      }),
      diagnostics: KnowledgeRagDiagnosticsSchema.parse({
        normalizedQuery: '根入口导出',
        retrievalMode: 'hybrid',
        hitCount: 1,
        contextChunkCount: 1
      }),
      operation: KnowledgeTraceOperationSchema.parse('rag.chat'),
      spanName: KnowledgeWorkbenchSpanNameSchema.parse('retrieve'),
      healthStatus: KnowledgeBaseHealthStatusSchema.parse('empty'),
      providerStatus: KnowledgeProviderHealthStatusSchema.parse('unconfigured'),
      ingestionStage: KnowledgeIngestionStageSchema.parse('uploaded'),
      ingestionStatus: KnowledgeIngestionJobStatusSchema.parse('queued'),
      routeReason: KnowledgeRagRouteReasonSchema.parse('fallback-all'),
      retrievalMode: KnowledgeRetrievalModeSchema.parse('hybrid'),
      workbenchTraceStatus: KnowledgeWorkbenchTraceStatusSchema.parse('ok'),
      traceSpanStatus: KnowledgeTraceSpanStatusSchema.parse('ok')
    };

    expect(typeSmoke.operation).toBe('rag.chat');
    expect(typeSmoke.spanName).toBe('retrieve');
    expect(typeSmoke.ingestionStage).toBe('uploaded');
    expect(typeSmoke.retrievalMode).toBe('hybrid');
  });

  it('exports the knowledge vector writer contract from the SDK boundary', async () => {
    expect(rootExports.KnowledgeVectorDocumentRecordSchema).toBe(KnowledgeVectorDocumentRecordSchema);

    const record: KnowledgeVectorDocumentRecord = {
      id: 'chunk-1',
      namespace: 'knowledge',
      sourceId: 'source-1',
      documentId: 'doc-1',
      chunkId: 'chunk-1',
      uri: '/docs/a.md',
      title: 'A',
      sourceType: 'repo-docs',
      content: 'hello',
      searchable: true
    };
    const written: KnowledgeVectorDocumentRecord[] = [];
    const writer: KnowledgeVectorIndexWriter = {
      async upsertKnowledge(nextRecord) {
        written.push(nextRecord);
      }
    };

    expect(KnowledgeVectorDocumentRecordSchema.parse(record)).toEqual(record);

    await writer.upsertKnowledge(record);

    expect(written).toEqual([record]);
  });

  it('retains the contract facade file as a stable contract-first entrypoint', () => {
    expect(existsSync(resolve(__dirname, '../src/contracts/knowledge-facade.ts'))).toBe(true);
    expect(rootExports.DefaultKnowledgeSearchService).toBe(retrievalExports.DefaultKnowledgeSearchService);
    expect(rootExports.DefaultQueryNormalizer).toBe(DefaultQueryNormalizer);
    expect(rootExports.runKnowledgeIndexing).toBe(runKnowledgeIndexing);
    expect(rootExports.createKnowledgeSourceIngestionLoader).toBe(createKnowledgeSourceIngestionLoader);
    expect(rootExports.ingestKnowledgeSourcePayloads).toBe(ingestKnowledgeSourcePayloads);
    expect(rootExports.buildUserUploadKnowledgePayload).toBe(buildUserUploadKnowledgePayload);
    expect(rootExports.buildCatalogSyncKnowledgePayload).toBe(buildCatalogSyncKnowledgePayload);
    expect(rootExports.buildWebCuratedKnowledgePayload).toBe(buildWebCuratedKnowledgePayload);
    expect(rootExports.buildConnectorSyncKnowledgePayload).toBe(buildConnectorSyncKnowledgePayload);
    expect(rootExports.DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE).toBe(DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE);
    expect(indexingExports.runKnowledgeIndexing).toBe(runKnowledgeIndexing);
    expect(contractExports).toBeTruthy();
  });

  it('re-exports hybrid retrieval engine and fusion strategy APIs', () => {
    expect(rootExports.HybridRetrievalEngine).toBe(HybridRetrievalEngine);
    expect(rootExports.RrfFusionStrategy).toBe(RrfFusionStrategy);
    expect(rootExports.createKnowledgeSearchServiceRetriever).toBe(createKnowledgeSearchServiceRetriever);
  });

  it('re-exports chat pre-retrieval routing APIs', () => {
    expect(rootExports.resolveKnowledgeChatRoute).toBe(resolveKnowledgeChatRoute);
    expect(rootExports.KnowledgeChatRoutingError).toBe(KnowledgeChatRoutingError);
  });

  it('re-exports the Small-to-Big context expander implementation', () => {
    expect(rootExports.SmallToBigContextExpander).toBe(SmallToBigContextExpander);
    expect(SmallToBigContextExpander).toBeTypeOf('function');
  });

  it('re-exports post-retrieval stage defaults', () => {
    expect(DefaultPostRetrievalFilter).toBe(rootExports.DefaultPostRetrievalFilter);
    expect(DefaultPostRetrievalRanker).toBe(rootExports.DefaultPostRetrievalRanker);
    expect(DefaultPostRetrievalDiversifier).toBe(rootExports.DefaultPostRetrievalDiversifier);
    expect(DefaultPostRetrievalFilter).toBeTypeOf('function');
    expect(DefaultPostRetrievalRanker).toBeTypeOf('function');
    expect(DefaultPostRetrievalDiversifier).toBeTypeOf('function');
  });

  it('re-exports observability APIs from the stable observability boundary', () => {
    expect(rootExports.createInMemoryKnowledgeRagObserver).toBe(createInMemoryKnowledgeRagObserver);
    expect(rootExports.createInMemoryKnowledgeRagObserver).toBe(
      observabilityExports.createInMemoryKnowledgeRagObserver
    );
    expect(rootExports.tryStartKnowledgeRagTrace).toBe(observabilityExports.tryStartKnowledgeRagTrace);
    expect(rootExports.tryRecordKnowledgeRagEvent).toBe(observabilityExports.tryRecordKnowledgeRagEvent);
    expect(rootExports.tryFinishKnowledgeRagTrace).toBe(observabilityExports.tryFinishKnowledgeRagTrace);
  });
});
