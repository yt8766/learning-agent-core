import { describe, expect, it } from 'vitest';
import type {
  ApiErrorDetailValue,
  ApiErrorDetails,
  ApiErrorResponse,
  AuthTokens,
  ChatResponse,
  CurrentUser,
  DashboardOverview,
  DocumentSourceType,
  EvalCaseResult,
  EvalRun,
  KnowledgeBase,
  KnowledgeDocument,
  LoginResponse,
  RagTraceDetail,
  RagTraceSpan,
  TraceSpanPayloadSummary,
  WorkspaceRole
} from '../src/types/api';

describe('knowledge frontend API types', () => {
  it('accepts MVP dashboard, chat, and trace shapes', () => {
    const tokens: AuthTokens = {
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    };
    const knowledgeBase: KnowledgeBase = {
      id: 'kb_1',
      workspaceId: 'ws_1',
      name: '前端知识库',
      tags: ['frontend'],
      visibility: 'workspace',
      status: 'active',
      documentCount: 1,
      chunkCount: 3,
      readyDocumentCount: 1,
      failedDocumentCount: 0,
      createdBy: 'user_1',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    };
    const dashboard: DashboardOverview = {
      knowledgeBaseCount: 1,
      documentCount: 1,
      readyDocumentCount: 1,
      failedDocumentCount: 0,
      todayQuestionCount: 1,
      activeAlertCount: 0,
      recentFailedJobs: [],
      recentLowScoreTraces: [],
      recentEvalRuns: [],
      topMissingKnowledgeQuestions: []
    };
    const chat: ChatResponse = {
      conversationId: 'conv_1',
      answer: '默认使用顶层静态 import。',
      traceId: 'trace_1',
      citations: [],
      userMessage: {
        id: 'msg_user',
        conversationId: 'conv_1',
        role: 'user',
        content: '动态导入有什么限制？',
        createdAt: '2026-05-01T00:00:00.000Z'
      },
      assistantMessage: {
        id: 'msg_assistant',
        conversationId: 'conv_1',
        role: 'assistant',
        content: '默认使用顶层静态 import。',
        citations: [],
        traceId: 'trace_1',
        createdAt: '2026-05-01T00:00:00.000Z'
      }
    };
    const trace: RagTraceDetail = {
      id: 'trace_1',
      workspaceId: 'ws_1',
      knowledgeBaseIds: ['kb_1'],
      question: '动态导入有什么限制？',
      answer: chat.answer,
      status: 'succeeded',
      createdAt: '2026-05-01T00:00:00.000Z',
      spans: [],
      citations: []
    };

    expect(tokens.tokenType).toBe('Bearer');
    expect(knowledgeBase.name).toBe('前端知识库');
    expect(dashboard.knowledgeBaseCount).toBe(1);
    expect(chat.traceId).toBe('trace_1');
    expect(trace.status).toBe('succeeded');
  });

  it('keeps auth roles and login response aligned with the contract', () => {
    const viewerRole: WorkspaceRole = 'viewer';
    const evaluatorRole: WorkspaceRole = 'evaluator';
    const currentUser: CurrentUser = {
      id: 'user_1',
      email: 'user@example.com',
      name: 'Reviewer',
      currentWorkspaceId: 'ws_1',
      roles: [viewerRole, evaluatorRole],
      permissions: ['knowledge:read']
    };
    const login: LoginResponse = {
      user: currentUser,
      tokens: {
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        expiresIn: 7200,
        refreshExpiresIn: 1209600
      }
    };

    expect(login.user.roles).toEqual(['viewer', 'evaluator']);
    expect(login.tokens.tokenType).toBe('Bearer');
  });

  it('limits API error details to redacted JSON-safe projections', () => {
    const detailValue: ApiErrorDetailValue = null;
    const details: ApiErrorDetails = {
      summary: '2 documents failed validation',
      fields: {
        title: 'Required'
      },
      data: {
        retryable: true,
        failedCount: 2,
        reason: 'unsupported_file_type',
        empty: detailValue,
        stages: ['parse', 'embed'],
        counts: [1, 2]
      },
      itemIds: ['doc_1', 'doc_2']
    };
    const error: ApiErrorResponse = {
      code: 'validation_error',
      message: 'Validation failed',
      details,
      requestId: 'req_1'
    };

    expect(error.details?.itemIds).toEqual(['doc_1', 'doc_2']);
  });

  it('rejects raw vendor payloads in API error details', () => {
    const rejectedHeaders = {
      code: 'provider_error',
      message: 'Provider failed',
      details: {
        data: {
          rawHeaders: {
            // @ts-expect-error ApiErrorDetails must not carry nested vendor raw payloads.
            authorization: 'Bearer secret'
          }
        }
      }
    } satisfies ApiErrorResponse;

    const rejectedObjectArray = {
      code: 'provider_error',
      message: 'Provider failed',
      details: {
        data: {
          // @ts-expect-error ApiErrorDetailValue only allows scalar arrays, not object arrays.
          rawItems: [{ id: 'vendor_1' }]
        }
      }
    } satisfies ApiErrorResponse;

    expect(rejectedHeaders.code).toBe('provider_error');
    expect(rejectedObjectArray.message).toBe('Provider failed');
  });

  it('limits trace span input and output to payload summaries', () => {
    const input: TraceSpanPayloadSummary = {
      summary: 'Embedded query text after redaction.',
      data: {
        model: 'text-embedding',
        hitLimit: 8,
        debug: false,
        empty: null,
        stages: ['embedding', 'vector_search'],
        ranks: [1, 2, 3]
      },
      itemIds: ['kb_1']
    };
    const span: RagTraceSpan = {
      id: 'span_1',
      traceId: 'trace_1',
      stage: 'embedding',
      name: 'Embed query',
      status: 'succeeded',
      input,
      output: {
        summary: 'Embedding completed.',
        data: {
          vectorCount: 1
        },
        itemIds: ['chunk_1']
      }
    };

    expect(span.input?.itemIds).toEqual(['kb_1']);
    expect(span.output?.data?.vectorCount).toBe(1);
  });

  it('rejects raw trace span payload objects', () => {
    const rejectedTracePayload = {
      summary: 'Raw provider response',
      data: {
        response: {
          // @ts-expect-error TraceSpanPayloadSummary must not carry nested raw responses.
          headers: {
            authorization: 'Bearer secret'
          }
        }
      }
    } satisfies TraceSpanPayloadSummary;

    expect(rejectedTracePayload.summary).toBe('Raw provider response');
  });

  it('keeps document source DTOs and enum values stable', () => {
    const connectorSource: DocumentSourceType = 'connector-sync';
    const webSource: DocumentSourceType = 'web-url';
    const document: KnowledgeDocument = {
      id: 'doc_1',
      workspaceId: 'ws_1',
      knowledgeBaseId: 'kb_1',
      title: 'Knowledge API contract',
      sourceType: connectorSource,
      uri: 'https://example.com/knowledge',
      status: 'ready',
      version: 'v1',
      chunkCount: 4,
      embeddedChunkCount: 4,
      createdBy: 'user_1',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    };

    expect(document.sourceType).toBe('connector-sync');
    expect(webSource).toBe('web-url');
  });

  it('keeps eval run and case result DTOs stable', () => {
    const run: EvalRun = {
      id: 'eval_run_1',
      workspaceId: 'ws_1',
      datasetId: 'dataset_1',
      knowledgeBaseIds: ['kb_1'],
      status: 'succeeded',
      caseCount: 1,
      completedCaseCount: 1,
      failedCaseCount: 0,
      summary: {
        totalScore: 92,
        retrievalScore: 94,
        generationScore: 90,
        citationScore: 91
      },
      createdBy: 'user_1',
      createdAt: '2026-05-01T00:00:00.000Z'
    };
    const result: EvalCaseResult = {
      id: 'eval_result_1',
      runId: run.id,
      caseId: 'case_1',
      status: 'succeeded',
      actualAnswer: 'Use top-level static imports by default.',
      citations: [],
      retrievalMetrics: {
        recallAtK: 1,
        precisionAtK: 1
      },
      generationMetrics: {
        faithfulness: 0.95,
        hallucinationRisk: 0.05
      },
      judgeResult: {
        score: 0.92,
        reason: 'Answer is grounded in the cited contract.'
      }
    };

    expect(run.summary?.totalScore).toBe(92);
    expect(result.judgeResult?.score).toBe(0.92);
  });
});
