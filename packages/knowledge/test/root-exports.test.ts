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
  KnowledgeErrorResponseSchema,
  KnowledgeEvalCaseSchema,
  KnowledgeEvalRunResultSchema,
  KnowledgeIngestionJobProjectionSchema,
  KnowledgeRagDiagnosticsSchema,
  KnowledgeRagRouteSchema,
  KnowledgeTraceOperationSchema,
  KnowledgeWorkbenchSpanNameSchema,
  buildCatalogSyncKnowledgePayload,
  buildConnectorSyncKnowledgePayload,
  buildUserUploadKnowledgePayload,
  buildWebCuratedKnowledgePayload,
  createKnowledgeSourceIngestionLoader,
  ingestKnowledgeSourcePayloads,
  runKnowledgeIndexing
} from '../src/index';
import type {
  KnowledgeBaseHealth,
  KnowledgeErrorResponse,
  KnowledgeEvalCase,
  KnowledgeEvalRunResult,
  KnowledgeIngestionJobProjection,
  KnowledgeRagDiagnostics,
  KnowledgeRagRoute,
  KnowledgeTraceOperation,
  KnowledgeWorkbenchSpanName
} from '../src/index';
import * as rootExports from '../src/index';
import * as contractExports from '../src/contracts/knowledge-facade';
import * as indexingExports from '../src/indexing';
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
    expect(rootExports.KnowledgeIngestionJobProjectionSchema).toBe(KnowledgeIngestionJobProjectionSchema);
    expect(rootExports.KnowledgeErrorResponseSchema).toBe(KnowledgeErrorResponseSchema);
    expect(rootExports.KnowledgeEvalCaseSchema).toBe(KnowledgeEvalCaseSchema);
    expect(rootExports.KnowledgeEvalRunResultSchema).toBe(KnowledgeEvalRunResultSchema);
    expect(rootExports.KnowledgeRagRouteSchema).toBe(KnowledgeRagRouteSchema);
    expect(rootExports.KnowledgeRagDiagnosticsSchema).toBe(KnowledgeRagDiagnosticsSchema);
    expect(rootExports.KnowledgeTraceOperationSchema).toBe(KnowledgeTraceOperationSchema);
    expect(rootExports.KnowledgeWorkbenchSpanNameSchema).toBe(KnowledgeWorkbenchSpanNameSchema);
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
      spanName: KnowledgeWorkbenchSpanNameSchema.parse('retrieve')
    };

    expect(typeSmoke.operation).toBe('rag.chat');
    expect(typeSmoke.spanName).toBe('retrieve');
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
});
