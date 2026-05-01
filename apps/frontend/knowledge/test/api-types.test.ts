import { describe, expect, it } from 'vitest';
import type { AuthTokens, ChatResponse, DashboardOverview, KnowledgeBase, RagTraceDetail } from '../src/types/api';

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
});
