import { describe, expect, it } from 'vitest';

import {
  KnowledgeBaseHealthSchema,
  KnowledgeErrorResponseSchema,
  KnowledgeEvalCaseSchema,
  KnowledgeEvalRunResultSchema,
  KnowledgeIngestionJobProjectionSchema,
  KnowledgeRagAnswerSchema,
  KnowledgeTraceSchema
} from '../src/core';

describe('trustworthy RAG workbench core contracts', () => {
  it('parses a degraded knowledge base health projection', () => {
    expect(
      KnowledgeBaseHealthSchema.parse({
        knowledgeBaseId: 'kb-1',
        status: 'degraded',
        documentCount: 12,
        searchableDocumentCount: 10,
        chunkCount: 320,
        failedJobCount: 2,
        lastIndexedAt: '2026-05-03T08:00:00.000Z',
        lastQueriedAt: '2026-05-03T08:03:00.000Z',
        providerHealth: {
          embedding: 'ok',
          vector: 'degraded',
          keyword: 'ok',
          generation: 'unconfigured'
        },
        warnings: [{ code: 'VECTOR_DEGRADED', message: 'Vector provider is degraded.' }]
      })
    ).toMatchObject({
      status: 'degraded',
      warnings: [{ code: 'VECTOR_DEGRADED', message: 'Vector provider is degraded.' }],
      providerHealth: { vector: 'degraded' }
    });
  });

  it('parses a failed retryable embedding ingestion job projection', () => {
    expect(
      KnowledgeIngestionJobProjectionSchema.parse({
        id: 'job-1',
        documentId: 'doc-1',
        stage: 'embedding',
        status: 'failed',
        progress: {
          percent: 45,
          processedChunks: 45,
          totalChunks: 100
        },
        error: {
          code: 'EMBEDDING_TIMEOUT',
          message: 'Embedding provider timed out.',
          retryable: true,
          stage: 'embedding'
        },
        attempts: 2,
        createdAt: '2026-05-03T08:00:00.000Z',
        updatedAt: '2026-05-03T08:02:00.000Z',
        completedAt: '2026-05-03T08:02:00.000Z'
      })
    ).toMatchObject({
      error: { retryable: true, stage: 'embedding' },
      progress: { percent: 45 }
    });
  });

  it('parses a grounded RAG answer with route, diagnostics, trace id, and citation quote', () => {
    expect(
      KnowledgeRagAnswerSchema.parse({
        id: 'answer-1',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        answer: '可信 RAG 工作台需要展示路由、诊断和引用证据。',
        traceId: 'trace-1',
        route: {
          requestedMentions: ['产品知识库'],
          selectedKnowledgeBaseIds: ['kb-1'],
          reason: 'metadata-match'
        },
        diagnostics: {
          normalizedQuery: '可信 rag 工作台 引用',
          queryVariants: ['可信 RAG 工作台需要什么证据？'],
          retrievalMode: 'hybrid',
          hitCount: 6,
          contextChunkCount: 3
        },
        citations: [
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            title: '可信RAG工作台设计.md',
            score: 0.92,
            text: '兼容旧字段',
            quote: '展示路由、诊断和引用证据'
          }
        ]
      })
    ).toMatchObject({
      traceId: 'trace-1',
      route: { reason: 'metadata-match' },
      diagnostics: { normalizedQuery: '可信 rag 工作台 引用', retrievalMode: 'hybrid' },
      citations: [{ quote: '展示路由、诊断和引用证据' }]
    });
  });

  it('rejects non JSON-safe trace span attributes', () => {
    expect(() =>
      KnowledgeTraceSchema.parse({
        traceId: 'trace-1',
        operation: 'rag.chat',
        startedAt: '2026-05-03T08:00:00.000Z',
        status: 'ok',
        spans: [
          {
            spanId: 'span-1',
            name: 'retrieve',
            startedAt: '2026-05-03T08:00:00.100Z',
            status: 'ok',
            error: {
              code: 'TRACE_ATTRIBUTE_NOT_JSON_SAFE',
              message: 'Trace attributes must be JSON-safe.'
            },
            attributes: {
              rawMetadata: new Map([['vendor', 'raw']])
            }
          }
        ]
      })
    ).toThrow();
  });

  it('allows provider health workbench traces without spans', () => {
    expect(
      KnowledgeTraceSchema.parse({
        traceId: 'trace-provider-health-1',
        operation: 'provider.health',
        startedAt: '2026-05-03T08:00:00.000Z',
        status: 'ok',
        documentId: 'doc-1',
        spans: []
      })
    ).toMatchObject({
      operation: 'provider.health',
      status: 'ok',
      documentId: 'doc-1',
      spans: []
    });
  });

  it('parses eval case, eval run result, and stable error response contracts', () => {
    expect(
      KnowledgeEvalCaseSchema.parse({
        id: 'case-1',
        datasetId: 'dataset-1',
        question: '如何验证可信 RAG 引用准确性？',
        expectedChunkIds: ['chunk-1'],
        expectedDocumentIds: ['doc-1'],
        expectedAnswerNote: '应检查答案是否由可追溯引用支撑。'
      })
    ).toMatchObject({ id: 'case-1', expectedChunkIds: ['chunk-1'] });

    expect(
      KnowledgeEvalRunResultSchema.parse({
        runId: 'run-1',
        caseId: 'case-1',
        answerId: 'answer-1',
        metrics: {
          recallAtK: 0.91,
          citationAccuracy: 0.84
        },
        traceId: 'trace-1'
      })
    ).toMatchObject({ metrics: { citationAccuracy: 0.84 } });

    expect(
      KnowledgeErrorResponseSchema.parse({
        code: 'KNOWLEDGE_PROVIDER_UNAVAILABLE',
        message: 'Embedding provider is unavailable.',
        retryable: true,
        traceId: 'trace-1',
        details: { provider: 'embedding' }
      })
    ).toMatchObject({ retryable: true, traceId: 'trace-1' });

    expect(() =>
      KnowledgeErrorResponseSchema.parse({
        code: 'KNOWLEDGE_PROVIDER_UNAVAILABLE',
        message: 'Embedding provider is unavailable.'
      })
    ).toThrow();
  });

  it('rejects legacy fields on strict trustworthy RAG contracts', () => {
    expect(() =>
      KnowledgeRagAnswerSchema.parse({
        id: 'answer-legacy-route',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        answer: '旧 route 字段不应被稳定契约吞掉。',
        route: {
          selectedKnowledgeBaseIds: ['kb-1'],
          candidateKnowledgeBaseIds: ['kb-1', 'kb-2'],
          reason: 'metadata-match'
        }
      })
    ).toThrow();

    expect(() =>
      KnowledgeErrorResponseSchema.parse({
        error: {
          code: 'KNOWLEDGE_PROVIDER_UNAVAILABLE',
          message: 'Embedding provider is unavailable.',
          retryable: true
        }
      })
    ).toThrow();

    expect(() =>
      KnowledgeEvalRunResultSchema.parse({
        runId: 'run-1',
        caseId: 'case-1',
        answerId: 'answer-1',
        metrics: {
          citationAccuracy: 0.84
        },
        traceId: 'trace-1',
        status: 'succeeded',
        scores: {
          citationAccuracy: 0.84
        }
      })
    ).toThrow();
  });

  it('rejects extra fields on strict trustworthy workbench contracts', () => {
    const healthProjection = {
      knowledgeBaseId: 'kb-1',
      status: 'degraded',
      documentCount: 12,
      searchableDocumentCount: 10,
      chunkCount: 320,
      failedJobCount: 2,
      providerHealth: {
        embedding: 'ok',
        vector: 'degraded',
        keyword: 'ok',
        generation: 'unconfigured'
      },
      warnings: [{ code: 'VECTOR_DEGRADED', message: 'Vector provider is degraded.' }]
    };

    expect(() => KnowledgeBaseHealthSchema.parse({ ...healthProjection, vendorRaw: true })).toThrow();
    expect(() =>
      KnowledgeBaseHealthSchema.parse({
        ...healthProjection,
        providerHealth: { ...healthProjection.providerHealth, vendorRaw: true }
      })
    ).toThrow();
    expect(() =>
      KnowledgeBaseHealthSchema.parse({
        ...healthProjection,
        warnings: [{ ...healthProjection.warnings[0], vendorRaw: true }]
      })
    ).toThrow();

    const ingestionJob = {
      id: 'job-1',
      documentId: 'doc-1',
      stage: 'embedding',
      status: 'failed',
      progress: {
        percent: 45,
        processedChunks: 45,
        totalChunks: 100
      },
      error: {
        code: 'EMBEDDING_TIMEOUT',
        message: 'Embedding provider timed out.',
        retryable: true,
        stage: 'embedding'
      },
      attempts: 2,
      createdAt: '2026-05-03T08:00:00.000Z',
      updatedAt: '2026-05-03T08:02:00.000Z'
    };

    expect(() => KnowledgeIngestionJobProjectionSchema.parse({ ...ingestionJob, vendorRaw: true })).toThrow();
    expect(() =>
      KnowledgeIngestionJobProjectionSchema.parse({
        ...ingestionJob,
        progress: { ...ingestionJob.progress, vendorRaw: true }
      })
    ).toThrow();
    expect(() =>
      KnowledgeIngestionJobProjectionSchema.parse({
        ...ingestionJob,
        error: { ...ingestionJob.error, vendorRaw: true }
      })
    ).toThrow();

    const ragAnswer = {
      id: 'answer-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      answer: '可信 RAG 工作台需要展示路由、诊断和引用证据。',
      diagnostics: {
        normalizedQuery: '可信 rag 工作台 引用',
        retrievalMode: 'hybrid',
        hitCount: 6,
        contextChunkCount: 3,
        vendorRaw: true
      }
    };

    expect(() => KnowledgeRagAnswerSchema.parse(ragAnswer)).toThrow();

    const traceSpan = {
      spanId: 'span-1',
      name: 'retrieve',
      startedAt: '2026-05-03T08:00:00.100Z',
      status: 'ok',
      error: {
        code: 'RETRIEVE_TIMEOUT',
        message: 'Retriever timed out.'
      }
    };

    const trace = {
      traceId: 'trace-1',
      operation: 'rag.chat',
      startedAt: '2026-05-03T08:00:00.000Z',
      status: 'ok',
      spans: [traceSpan]
    };

    expect(() => KnowledgeTraceSchema.parse({ ...trace, vendorRaw: true })).toThrow();
    expect(() =>
      KnowledgeTraceSchema.parse({
        ...trace,
        spans: [{ ...traceSpan, vendorRaw: true }]
      })
    ).toThrow();
    expect(() =>
      KnowledgeTraceSchema.parse({
        ...trace,
        spans: [{ ...traceSpan, error: { ...traceSpan.error, vendorRaw: true } }]
      })
    ).toThrow();

    expect(() =>
      KnowledgeEvalCaseSchema.parse({
        id: 'case-1',
        datasetId: 'dataset-1',
        question: '如何验证可信 RAG 引用准确性？',
        vendorRaw: true
      })
    ).toThrow();

    expect(() =>
      KnowledgeEvalRunResultSchema.parse({
        runId: 'run-1',
        caseId: 'case-1',
        answerId: 'answer-1',
        metrics: {
          citationAccuracy: 0.84,
          vendorRaw: true
        },
        traceId: 'trace-1'
      })
    ).toThrow();
  });
});
