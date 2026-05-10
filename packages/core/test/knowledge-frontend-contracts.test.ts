import { describe, expect, it } from 'vitest';

import {
  KnowledgeDashboardOverviewSchema,
  KnowledgeDocumentSchema,
  KnowledgeCreateDocumentFromUploadRequestSchema,
  KnowledgeCreateDocumentFromUploadResponseSchema,
  KnowledgeDocumentProcessingJobSchema,
  KnowledgeDocumentChunkSchema,
  KnowledgeEmbeddingModelOptionSchema,
  KnowledgeObservabilityMetricsSchema,
  KnowledgeRagTraceSchema,
  KnowledgeRagTraceDetailSchema,
  KnowledgeRetrievalSnapshotSchema,
  KnowledgeEvalDatasetSchema,
  KnowledgeEvalCaseSchema,
  KnowledgeEvalRunSchema,
  KnowledgeEvalCaseResultSchema,
  KnowledgeEvalRunComparisonSchema,
  KnowledgeServiceErrorCodeSchema
} from '../src/contracts/knowledge-service';

describe('Knowledge frontend dashboard contracts', () => {
  it('parses dashboard overview with all metric fields', () => {
    const parsed = KnowledgeDashboardOverviewSchema.parse({
      activeAlertCount: 2,
      averageLatencyMs: 320,
      documentCount: 156,
      failedDocumentCount: 3,
      knowledgeBaseCount: 5,
      latestEvalScore: 87.5,
      negativeFeedbackRate: 0.04,
      noAnswerRate: 0.02,
      p95LatencyMs: 890,
      p99LatencyMs: 1450,
      readyDocumentCount: 150,
      recentEvalRuns: [
        {
          id: 'eval_1',
          status: 'completed',
          score: 91.2,
          createdAt: '2026-05-10T08:00:00.000Z'
        }
      ],
      recentFailedJobs: [
        {
          jobId: 'job_1',
          documentId: 'doc_1',
          filename: 'guide.pdf',
          error: 'Embedding timeout',
          failedAt: '2026-05-10T07:30:00.000Z'
        }
      ],
      recentLowScoreTraces: [
        {
          id: 'trace_1',
          question: 'How to configure SSO?',
          score: 32.0,
          createdAt: '2026-05-10T06:00:00.000Z'
        }
      ],
      todayQuestionCount: 128,
      topMissingKnowledgeQuestions: [
        {
          question: 'How to reset password?',
          count: 15,
          lastAskedAt: '2026-05-10T09:00:00.000Z'
        }
      ]
    });

    expect(parsed.activeAlertCount).toBe(2);
    expect(parsed.latestEvalScore).toBe(87.5);
    expect(parsed.recentEvalRuns).toHaveLength(1);
    expect(parsed.recentFailedJobs[0]?.filename).toBe('guide.pdf');
    expect(parsed.topMissingKnowledgeQuestions[0]?.count).toBe(15);
  });

  it('accepts null for latestEvalScore', () => {
    const parsed = KnowledgeDashboardOverviewSchema.parse({
      activeAlertCount: 0,
      averageLatencyMs: 0,
      documentCount: 0,
      failedDocumentCount: 0,
      knowledgeBaseCount: 0,
      latestEvalScore: null,
      negativeFeedbackRate: 0,
      noAnswerRate: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      readyDocumentCount: 0,
      recentEvalRuns: [],
      recentFailedJobs: [],
      recentLowScoreTraces: [],
      todayQuestionCount: 0,
      topMissingKnowledgeQuestions: []
    });

    expect(parsed.latestEvalScore).toBeNull();
  });
});

describe('Knowledge frontend document contracts', () => {
  const baseDocument = {
    id: 'doc_1',
    knowledgeBaseId: 'kb_1',
    title: 'API Reference',
    filename: 'api-reference.pdf',
    sourceType: 'user-upload',
    status: 'ready' as const,
    chunkCount: 42,
    embeddedChunkCount: 42,
    objectKey: 'uploads/doc_1/api-reference.pdf',
    uploadId: 'upload_1',
    metadata: { category: 'technical' },
    createdBy: 'user_1',
    createdAt: '2026-05-10T08:00:00.000Z',
    updatedAt: '2026-05-10T08:05:00.000Z',
    version: 'v1'
  };

  it('parses a knowledge document', () => {
    const parsed = KnowledgeDocumentSchema.parse(baseDocument);

    expect(parsed.status).toBe('ready');
    expect(parsed.chunkCount).toBe(42);
    expect(parsed.metadata).toEqual({ category: 'technical' });
  });

  it('parses create document from upload request with defaults', () => {
    const parsed = KnowledgeCreateDocumentFromUploadRequestSchema.parse({
      knowledgeBaseId: 'kb_1',
      uploadId: 'upload_1',
      title: 'API Reference',
      filename: 'api-reference.pdf'
    });

    expect(parsed.sourceType).toBe('user-upload');
    expect(parsed.metadata).toBeUndefined();
  });

  it('parses create document from upload response', () => {
    const parsed = KnowledgeCreateDocumentFromUploadResponseSchema.parse({
      document: baseDocument,
      jobId: 'job_1'
    });

    expect(parsed.document.id).toBe('doc_1');
    expect(parsed.jobId).toBe('job_1');
  });

  it('parses document processing job', () => {
    const parsed = KnowledgeDocumentProcessingJobSchema.parse({
      id: 'job_1',
      documentId: 'doc_1',
      stage: 'chunking',
      status: 'running',
      progress: { percent: 65 },
      error: null,
      retryable: true,
      createdAt: '2026-05-10T08:00:00.000Z',
      updatedAt: '2026-05-10T08:02:00.000Z'
    });

    expect(parsed.status).toBe('running');
    expect(parsed.progress.percent).toBe(65);
    expect(parsed.error).toBeNull();
  });

  it('parses document chunks', () => {
    const parsed = KnowledgeDocumentChunkSchema.parse({
      id: 'chunk_1',
      documentId: 'doc_1',
      index: 0,
      content: 'This is the first chunk of the document.',
      tokenCount: 120,
      embeddingStatus: 'completed',
      createdAt: '2026-05-10T08:01:00.000Z'
    });

    expect(parsed.index).toBe(0);
    expect(parsed.embeddingStatus).toBe('completed');
  });

  it('parses embedding model options', () => {
    const parsed = KnowledgeEmbeddingModelOptionSchema.parse({
      id: 'text-embedding-3-small',
      label: 'Text Embedding 3 Small',
      dimensions: 1536,
      maxTokens: 8191,
      status: 'available'
    });

    expect(parsed.dimensions).toBe(1536);
    expect(parsed.status).toBe('available');
  });
});

describe('Knowledge frontend observability contracts', () => {
  it('parses observability metrics with stage latencies', () => {
    const parsed = KnowledgeObservabilityMetricsSchema.parse({
      averageLatencyMs: 320,
      citationClickRate: 0.45,
      errorRate: 0.02,
      negativeFeedbackRate: 0.04,
      noAnswerRate: 0.01,
      p95LatencyMs: 890,
      p99LatencyMs: 1450,
      questionCount: 5200,
      stageLatency: [
        { stage: 'retrieval', averageMs: 120, p95Ms: 350 },
        { stage: 'generation', averageMs: 200, p95Ms: 600 }
      ],
      timeoutRate: 0.005,
      traceCount: 5100
    });

    expect(parsed.stageLatency).toHaveLength(2);
    expect(parsed.stageLatency[0]?.stage).toBe('retrieval');
    expect(parsed.citationClickRate).toBe(0.45);
  });

  it('parses a RAG trace', () => {
    const parsed = KnowledgeRagTraceSchema.parse({
      id: 'trace_1',
      question: 'How to configure SSO?',
      answer: 'To configure SSO, navigate to Settings...',
      status: 'succeeded',
      knowledgeBaseIds: ['kb_1', 'kb_2'],
      workspaceId: 'ws_1',
      createdAt: '2026-05-10T08:00:00.000Z'
    });

    expect(parsed.status).toBe('succeeded');
    expect(parsed.knowledgeBaseIds).toHaveLength(2);
  });

  it('parses RAG trace detail with spans and citations', () => {
    const parsed = KnowledgeRagTraceDetailSchema.parse({
      id: 'trace_1',
      question: 'How to configure SSO?',
      answer: 'To configure SSO, navigate to Settings...',
      status: 'succeeded',
      knowledgeBaseIds: ['kb_1'],
      workspaceId: 'ws_1',
      createdAt: '2026-05-10T08:00:00.000Z',
      spans: [
        {
          id: 'span_1',
          name: 'retrieval',
          startMs: 0,
          endMs: 120,
          status: 'succeeded'
        },
        {
          id: 'span_2',
          name: 'generation',
          startMs: 120,
          endMs: 450,
          status: 'succeeded'
        }
      ],
      citations: [
        {
          documentId: 'doc_1',
          chunkId: 'chunk_1',
          title: 'SSO Setup Guide',
          snippet: 'To configure SSO...',
          score: 0.92
        }
      ]
    });

    expect(parsed.spans).toHaveLength(2);
    expect(parsed.citations[0]?.score).toBe(0.92);
  });

  it('parses retrieval snapshot', () => {
    const parsed = KnowledgeRetrievalSnapshotSchema.parse({
      knowledgeBaseId: 'kb_1',
      hitCount: 8,
      totalCount: 156,
      retrievalMode: 'hybrid'
    });

    expect(parsed.hitCount).toBe(8);
    expect(parsed.retrievalMode).toBe('hybrid');
  });
});

describe('Knowledge frontend evals contracts', () => {
  it('parses eval dataset', () => {
    const parsed = KnowledgeEvalDatasetSchema.parse({
      id: 'ds_1',
      name: 'SSO FAQ',
      description: 'Test cases for SSO-related questions',
      caseCount: 25,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-10T00:00:00.000Z'
    });

    expect(parsed.caseCount).toBe(25);
    expect(parsed.name).toBe('SSO FAQ');
  });

  it('parses eval case', () => {
    const parsed = KnowledgeEvalCaseSchema.parse({
      id: 'case_1',
      datasetId: 'ds_1',
      question: 'How to enable SSO?',
      expectedAnswer: 'Navigate to Settings > Security > SSO',
      expectedChunkIds: ['chunk_1', 'chunk_5'],
      metadata: { difficulty: 'easy' },
      createdAt: '2026-05-01T00:00:00.000Z'
    });

    expect(parsed.expectedChunkIds).toHaveLength(2);
    expect(parsed.metadata).toEqual({ difficulty: 'easy' });
  });

  it('parses eval run', () => {
    const parsed = KnowledgeEvalRunSchema.parse({
      id: 'run_1',
      datasetId: 'ds_1',
      knowledgeBaseIds: ['kb_1'],
      status: 'completed',
      caseCount: 25,
      completedCaseCount: 23,
      failedCaseCount: 2,
      createdBy: 'user_1',
      workspaceId: 'ws_1',
      createdAt: '2026-05-10T08:00:00.000Z'
    });

    expect(parsed.status).toBe('completed');
    expect(parsed.completedCaseCount).toBe(23);
    expect(parsed.failedCaseCount).toBe(2);
  });

  it('parses eval case result', () => {
    const parsed = KnowledgeEvalCaseResultSchema.parse({
      id: 'result_1',
      runId: 'run_1',
      caseId: 'case_1',
      question: 'How to enable SSO?',
      actualAnswer: 'Go to Settings and enable SSO.',
      status: 'passed',
      score: 0.88,
      latencyMs: 450,
      retrievedChunkIds: ['chunk_1', 'chunk_5', 'chunk_8'],
      createdAt: '2026-05-10T08:05:00.000Z'
    });

    expect(parsed.status).toBe('passed');
    expect(parsed.score).toBe(0.88);
    expect(parsed.retrievedChunkIds).toHaveLength(3);
  });

  it('parses eval run comparison', () => {
    const parsed = KnowledgeEvalRunComparisonSchema.parse({
      runs: [
        {
          id: 'run_1',
          datasetId: 'ds_1',
          knowledgeBaseIds: ['kb_1'],
          status: 'completed',
          caseCount: 25,
          completedCaseCount: 25,
          failedCaseCount: 0,
          createdBy: 'user_1',
          workspaceId: 'ws_1',
          createdAt: '2026-05-09T08:00:00.000Z'
        },
        {
          id: 'run_2',
          datasetId: 'ds_1',
          knowledgeBaseIds: ['kb_1'],
          status: 'completed',
          caseCount: 25,
          completedCaseCount: 24,
          failedCaseCount: 1,
          createdBy: 'user_1',
          workspaceId: 'ws_1',
          createdAt: '2026-05-10T08:00:00.000Z'
        }
      ],
      metrics: [
        { name: 'accuracy', values: [0.92, 0.88] },
        { name: 'avg_latency_ms', values: [320, 410] }
      ]
    });

    expect(parsed.runs).toHaveLength(2);
    expect(parsed.metrics[0]?.name).toBe('accuracy');
    expect(parsed.metrics[0]?.values).toEqual([0.92, 0.88]);
  });
});

describe('Knowledge service error codes', () => {
  it('includes new frontend-specific error codes', () => {
    const newCodes = [
      'document_not_found',
      'conversation_not_found',
      'message_not_found',
      'trace_not_found',
      'eval_dataset_not_found',
      'eval_run_not_found',
      'knowledge_agent_flow_not_found',
      'knowledge_agent_flow_conflict',
      'knowledge_chat_failed',
      'validation_error',
      'auth_unauthorized'
    ] as const;

    for (const code of newCodes) {
      expect(KnowledgeServiceErrorCodeSchema.parse(code)).toBe(code);
    }
  });

  it('still accepts legacy error codes', () => {
    expect(KnowledgeServiceErrorCodeSchema.parse('auth_required')).toBe('auth_required');
    expect(KnowledgeServiceErrorCodeSchema.parse('knowledge_base_not_found')).toBe('knowledge_base_not_found');
    expect(KnowledgeServiceErrorCodeSchema.parse('internal_error')).toBe('internal_error');
  });
});
