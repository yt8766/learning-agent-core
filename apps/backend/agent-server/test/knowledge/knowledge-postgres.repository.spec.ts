import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeSqlClient } from '../../src/knowledge/repositories/knowledge-sql-client';
import type {
  KnowledgeBaseRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentRecord,
  KnowledgeEvalResultRecord,
  KnowledgeEvalRunRecord,
  KnowledgeTraceRecord
} from '../../src/knowledge/interfaces/knowledge-records.types';
import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';
import { FakeKnowledgeSqlClient } from './knowledge-postgres.repository.helpers';

const now = '2026-05-01T09:00:00.000Z';
const embedding1024 = Array.from({ length: 1024 }, (_, index) => (index < 3 ? [0.1, 0.2, 0.3][index]! : 0));

describe('PostgresKnowledgeRepository', () => {
  it('serializes jsonb and vector write parameters before sending them to SQL', async () => {
    const client = new FakeKnowledgeSqlClient();
    const repository = new PostgresKnowledgeRepository(client);

    await repository.createKnowledgeBase(baseRecord());
    await repository.createChunk(chunkRecord());
    await repository.createEvalResult(evalResultRecord());
    await repository.createTrace(traceRecord());

    expect(client.serializedWrites).toEqual(
      expect.arrayContaining([
        'knowledge_bases.tags',
        'knowledge_bases.metadata',
        'knowledge_chunks.embedding',
        'knowledge_chunks.metadata',
        'knowledge_eval_results.retrieved_chunk_ids',
        'knowledge_eval_results.citations',
        'knowledge_eval_results.retrieval_metrics',
        'knowledge_eval_results.generation_metrics',
        'knowledge_traces.knowledge_base_ids',
        'knowledge_traces.spans',
        'knowledge_traces.metadata'
      ])
    );
  });

  it('upserts and lists documents without leaking rows to callers', async () => {
    const client = new FakeKnowledgeSqlClient();
    const repository = new PostgresKnowledgeRepository(client);

    await repository.createDocument(documentRecord({ title: 'RAG知识框架.pptx', status: 'uploaded' }));
    await repository.createDocument(documentRecord({ title: 'RAG知识框架 v2.pptx', status: 'ready' }));
    await repository.createDocument(documentRecord({ id: 'doc-other', knowledgeBaseId: 'kb-other' }));

    const result = await repository.listDocuments({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' });

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'doc-1',
        tenantId: 'tenant-1',
        knowledgeBaseId: 'kb-1',
        title: 'RAG知识框架 v2.pptx',
        status: 'ready',
        metadata: { tags: ['rag'] }
      })
    ]);
    expect(result.items[0]).not.toHaveProperty('tenant_id');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('$1'), expect.any(Array));
  });

  it('lists chunks using optional knowledge base and document filters', async () => {
    const repository = new PostgresKnowledgeRepository(new FakeKnowledgeSqlClient());

    await repository.createChunk(chunkRecord({ id: 'chunk-1', documentId: 'doc-1', knowledgeBaseId: 'kb-1' }));
    await repository.createChunk(chunkRecord({ id: 'chunk-2', documentId: 'doc-2', knowledgeBaseId: 'kb-1' }));
    await repository.createChunk(chunkRecord({ id: 'chunk-3', documentId: 'doc-1', knowledgeBaseId: 'kb-2' }));

    await expect(repository.listChunks({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toMatchObject({
      items: [{ id: 'chunk-1' }, { id: 'chunk-2' }]
    });
    await expect(repository.listChunks({ tenantId: 'tenant-1', documentId: 'doc-1' })).resolves.toMatchObject({
      items: [{ id: 'chunk-1' }, { id: 'chunk-3' }]
    });
    const result = await repository.listChunks({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1', documentId: 'doc-1' });

    expect(result.items[0]).toMatchObject({ id: 'chunk-1', metadata: { page: 1 } });
    expect(result.items[0]?.embedding).toHaveLength(1024);
    expect(result.items[0]?.embedding?.slice(0, 3)).toEqual([0.1, 0.2, 0.3]);
  });

  it('rejects chunk embeddings that do not match the pgvector schema dimension', async () => {
    const client: KnowledgeSqlClient = { query: vi.fn(async () => ({ rows: [] })) };
    const repository = new PostgresKnowledgeRepository(client);

    await expect(repository.createChunk(chunkRecord({ embedding: [0.1, 0.2, 0.3] }))).rejects.toThrow(
      'Knowledge chunk embedding must contain 1024 dimensions for pgvector storage'
    );
    expect(client.query).not.toHaveBeenCalled();
  });

  it('round-trips eval run metadata without persisting empty createdBy placeholders', async () => {
    const client = new FakeKnowledgeSqlClient();
    const repository = new PostgresKnowledgeRepository(client);

    const created = await repository.createEvalRun(evalRunRecord({ createdBy: undefined, metadata: { suite: 'rag' } }));
    const updated = await repository.updateEvalRun({
      ...created,
      status: 'succeeded',
      metadata: { suite: 'rag', phase: 'green' }
    });

    expect(created).toMatchObject({ metadata: { suite: 'rag' } });
    expect(created).not.toHaveProperty('createdBy');
    expect(updated).toMatchObject({ status: 'succeeded', metadata: { suite: 'rag', phase: 'green' } });
    expect(client.serializedWrites).toContain('knowledge_eval_runs.metadata');
  });

  it('maps eval results and traces while preserving default jsonb arrays and objects', async () => {
    const repository = new PostgresKnowledgeRepository(new FakeKnowledgeSqlClient());

    await repository.createEvalResult(
      evalResultRecord({ retrievedChunkIds: [], citations: [], traceId: undefined, errorMessage: undefined })
    );
    await repository.createTrace(
      traceRecord({ knowledgeBaseIds: [], spans: [], metadata: {}, conversationId: undefined, messageId: undefined })
    );

    await expect(repository.listEvalResults({ tenantId: 'tenant-1', runId: 'run-1' })).resolves.toMatchObject({
      items: [{ retrievedChunkIds: [], citations: [] }]
    });
    await expect(repository.listTraces({ tenantId: 'tenant-1' })).resolves.toMatchObject({
      items: [{ knowledgeBaseIds: [], spans: [], metadata: {} }]
    });
  });
});

function baseRecord(overrides: Partial<KnowledgeBaseRecord> = {}): KnowledgeBaseRecord {
  return {
    id: 'kb-1',
    tenantId: 'tenant-1',
    name: '知识库',
    visibility: 'workspace',
    status: 'active',
    tags: ['rag'],
    createdBy: 'user-1',
    metadata: { owner: 'team' },
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function documentRecord(overrides: Partial<KnowledgeDocumentRecord> = {}): KnowledgeDocumentRecord {
  return {
    id: 'doc-1',
    tenantId: 'tenant-1',
    knowledgeBaseId: 'kb-1',
    title: 'RAG知识框架.pptx',
    status: 'ready',
    sourceUri: 'file://rag.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    metadata: { tags: ['rag'] },
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function chunkRecord(overrides: Partial<KnowledgeChunkRecord> = {}): KnowledgeChunkRecord {
  return {
    id: 'chunk-1',
    tenantId: 'tenant-1',
    knowledgeBaseId: 'kb-1',
    documentId: 'doc-1',
    text: '常见的评测内容有检索评测、生成评测、端到端评测。',
    ordinal: 1,
    tokenCount: 42,
    embedding: embedding1024,
    metadata: { page: 1 },
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function evalRunRecord(overrides: Partial<KnowledgeEvalRunRecord> = {}): KnowledgeEvalRunRecord {
  return {
    id: 'run-1',
    tenantId: 'tenant-1',
    datasetId: 'dataset-1',
    status: 'running',
    metrics: { totalScore: 0 },
    summary: {
      caseCount: 1,
      completedCaseCount: 0,
      failedCaseCount: 0,
      totalScore: 0,
      retrievalScore: 0,
      generationScore: 0
    },
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function evalResultRecord(overrides: Partial<KnowledgeEvalResultRecord> = {}): KnowledgeEvalResultRecord {
  return {
    id: 'result-1',
    tenantId: 'tenant-1',
    runId: 'run-1',
    caseId: 'case-1',
    status: 'succeeded',
    question: '如何评测知识库回答？',
    actualAnswer: '通过检索和生成指标联合评测。',
    retrievedChunkIds: ['chunk-1', 'chunk-2'],
    citations: [{ chunkId: 'chunk-1', title: 'RAG知识框架.pptx' }],
    retrievalMetrics: { recallAtK: 1, precisionAtK: 0.5, mrr: 1, ndcg: 0.9 },
    generationMetrics: { faithfulness: 0.92, answerRelevance: 0.88, citationAccuracy: 1 },
    traceId: 'trace-1',
    errorMessage: 'needs review',
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function traceRecord(overrides: Partial<KnowledgeTraceRecord> = {}): KnowledgeTraceRecord {
  return {
    id: 'trace-1',
    tenantId: 'tenant-1',
    operation: 'rag.chat',
    status: 'succeeded',
    knowledgeBaseIds: ['kb-1'],
    conversationId: 'conversation-1',
    messageId: 'message-1',
    latencyMs: 123,
    spans: [{ id: 'span-1', name: 'retrieve' }],
    metadata: { topK: 8 },
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}
