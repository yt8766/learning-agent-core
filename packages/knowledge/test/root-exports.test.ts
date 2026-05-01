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
  createKnowledgeSearchServiceRetriever,
  InMemoryKnowledgeChunkRepository,
  InMemoryKnowledgeSourceRepository,
  RrfFusionStrategy,
  SmallToBigContextExpander,
  ingestLocalKnowledge,
  LocalKnowledgeFacade,
  listKnowledgeArtifacts,
  readKnowledgeOverview,
  RetrievalRequestSchema,
  HybridKnowledgeSearchProductionConfigSchema,
  runKnowledgeIndexing
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

  it('retains the contract facade file as a stable contract-first entrypoint', () => {
    expect(existsSync(resolve(__dirname, '../src/contracts/knowledge-facade.ts'))).toBe(true);
    expect(rootExports.DefaultKnowledgeSearchService).toBe(retrievalExports.DefaultKnowledgeSearchService);
    expect(rootExports.DefaultQueryNormalizer).toBe(DefaultQueryNormalizer);
    expect(rootExports.runKnowledgeIndexing).toBe(runKnowledgeIndexing);
    expect(rootExports.DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE).toBe(DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE);
    expect(indexingExports.runKnowledgeIndexing).toBe(runKnowledgeIndexing);
    expect(contractExports).toBeTruthy();
  });

  it('re-exports hybrid retrieval engine and fusion strategy APIs', () => {
    expect(rootExports.HybridRetrievalEngine).toBe(HybridRetrievalEngine);
    expect(rootExports.RrfFusionStrategy).toBe(RrfFusionStrategy);
    expect(rootExports.createKnowledgeSearchServiceRetriever).toBe(createKnowledgeSearchServiceRetriever);
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
