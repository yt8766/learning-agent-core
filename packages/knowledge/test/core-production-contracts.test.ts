import { describe, expect, it } from 'vitest';

import {
  KnowledgeAuthSessionSchema,
  KnowledgeEvalRunSchema,
  KnowledgeRagAnswerSchema,
  KnowledgeTraceSchema,
  KnowledgeVectorSearchRequestSchema
} from '../src/core';

describe('knowledge production core contracts', () => {
  it('parses a JWT double-token auth session', () => {
    expect(
      KnowledgeAuthSessionSchema.parse({
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          name: 'Owner',
          avatarUrl: 'https://example.com/avatar.png',
          currentWorkspaceId: 'workspace-1',
          roles: ['owner'],
          permissions: ['knowledge:read', 'knowledge:write']
        },
        tokens: {
          accessToken: 'access.jwt.value',
          refreshToken: 'refresh.jwt.value',
          tokenType: 'Bearer',
          expiresIn: 7200,
          refreshExpiresIn: 1209600
        }
      })
    ).toMatchObject({
      user: {
        currentWorkspaceId: 'workspace-1',
        permissions: ['knowledge:read', 'knowledge:write']
      },
      tokens: { tokenType: 'Bearer' }
    });
  });

  it('rejects auth users without permissions or with unknown fields', () => {
    const validTokens = {
      accessToken: 'access.jwt.value',
      refreshToken: 'refresh.jwt.value',
      tokenType: 'Bearer' as const,
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    };

    expect(() =>
      KnowledgeAuthSessionSchema.parse({
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          roles: ['owner']
        },
        tokens: validTokens
      })
    ).toThrow();

    expect(() =>
      KnowledgeAuthSessionSchema.parse({
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          roles: ['owner'],
          permissions: ['knowledge:read'],
          vendorRole: 'raw'
        },
        tokens: validTokens
      })
    ).toThrow();
  });

  it('rejects the legacy flat auth session shape', () => {
    expect(() =>
      KnowledgeAuthSessionSchema.parse({
        accessToken: 'access.jwt.value',
        refreshToken: 'refresh.jwt.value',
        tokenType: 'Bearer',
        expiresAt: '2026-05-01T09:00:00.000Z',
        refreshExpiresAt: '2026-05-08T09:00:00.000Z',
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          name: 'Owner',
          roles: ['owner']
        }
      })
    ).toThrow();
  });

  it('parses a vector search request without leaking vendor fields', () => {
    expect(
      KnowledgeVectorSearchRequestSchema.parse({
        knowledgeBaseId: 'kb-1',
        query: '如何设计知识库评测系统',
        embedding: [0.1, 0.2, 0.3],
        topK: 8,
        filters: {
          documentIds: ['doc-1'],
          tags: ['frontend'],
          metadata: { source: 'manual' }
        }
      })
    ).toMatchObject({ topK: 8 });
  });

  it('parses a RAG answer with citations', () => {
    expect(
      KnowledgeRagAnswerSchema.parse({
        id: 'answer-1',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        answer: '可以先评测检索，再评测生成，最后做端到端回归。',
        citations: [
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            title: 'RAG知识框架.pptx',
            score: 0.91,
            text: '常见的评测内容有检索评测、生成评测、端到端评测。'
          }
        ],
        usage: { inputTokens: 1200, outputTokens: 180, totalTokens: 1380 }
      })
    ).toMatchObject({ citations: [{ chunkId: 'chunk-1' }] });

    expect(
      KnowledgeRagAnswerSchema.parse({
        id: 'answer-2',
        conversationId: 'conversation-1',
        messageId: 'message-2',
        answer: 'Token usage can be partially reported.',
        citations: [],
        usage: { totalTokens: 100 }
      })
    ).toMatchObject({ usage: { totalTokens: 100 } });
  });

  it('parses an eval run with retrieval and generation metrics', () => {
    expect(
      KnowledgeEvalRunSchema.parse({
        id: 'eval-run-1',
        datasetId: 'dataset-1',
        status: 'succeeded',
        startedAt: '2026-05-01T09:00:00.000Z',
        completedAt: '2026-05-01T09:03:00.000Z',
        metrics: {
          recallAtK: 0.86,
          precisionAtK: 0.72,
          mrr: 0.67,
          ndcg: 0.81,
          faithfulness: 0.9,
          answerRelevance: 0.88,
          citationAccuracy: 0.84
        }
      })
    ).toMatchObject({ status: 'succeeded' });
  });

  it('parses an observability trace with stage spans', () => {
    expect(
      KnowledgeTraceSchema.parse({
        traceId: 'trace-1',
        requestId: 'request-1',
        userId: 'user-1',
        knowledgeBaseId: 'kb-1',
        operation: 'rag.chat',
        startedAt: '2026-05-01T09:00:00.000Z',
        endedAt: '2026-05-01T09:00:02.000Z',
        status: 'succeeded',
        spans: [
          {
            spanId: 'span-1',
            name: 'retrieval',
            stage: 'vector_search',
            startedAt: '2026-05-01T09:00:00.100Z',
            endedAt: '2026-05-01T09:00:00.650Z',
            attributes: { topK: 8 }
          }
        ]
      })
    ).toMatchObject({ operation: 'rag.chat' });
  });

  it('rejects vendor raw fields on vector search requests', () => {
    expect(() =>
      KnowledgeVectorSearchRequestSchema.parse({
        knowledgeBaseId: 'kb-1',
        query: '如何设计知识库评测系统',
        embedding: [0.1, 0.2, 0.3],
        topK: 8,
        providerRawResponse: { vendor: 'raw' }
      })
    ).toThrow();
  });

  it('rejects legacy eval run status values', () => {
    expect(() =>
      KnowledgeEvalRunSchema.parse({
        id: 'eval-run-1',
        datasetId: 'dataset-1',
        status: 'completed',
        metrics: {}
      })
    ).toThrow();
  });

  it('rejects legacy trace status and unknown span stages', () => {
    expect(() =>
      KnowledgeTraceSchema.parse({
        traceId: 'trace-1',
        operation: 'rag.chat',
        startedAt: '2026-05-01T09:00:00.000Z',
        status: 'ok',
        spans: []
      })
    ).toThrow();

    expect(() =>
      KnowledgeTraceSchema.parse({
        traceId: 'trace-1',
        operation: 'rag.chat',
        startedAt: '2026-05-01T09:00:00.000Z',
        status: 'running',
        spans: [
          {
            spanId: 'span-1',
            name: 'retrieval',
            stage: 'vendor_specific_stage',
            startedAt: '2026-05-01T09:00:00.100Z'
          }
        ]
      })
    ).toThrow();
  });

  it('rejects citation scores and eval metrics outside the normalized range', () => {
    expect(() =>
      KnowledgeRagAnswerSchema.parse({
        id: 'answer-1',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        answer: '越界分数不应进入稳定契约。',
        citations: [
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            score: 1.2
          }
        ]
      })
    ).toThrow();

    expect(() =>
      KnowledgeEvalRunSchema.parse({
        id: 'eval-run-1',
        datasetId: 'dataset-1',
        status: 'succeeded',
        metrics: { recallAtK: -0.1 }
      })
    ).toThrow();
  });
});
