import type { ChatRequest, ChatResponse, PageResult } from '../types/api';
import {
  mockDashboard,
  mockDocuments,
  mockEvalDatasets,
  mockEvalRuns,
  mockKnowledgeBases,
  mockTraceDetail
} from './mock-data';

export class MockKnowledgeApiClient {
  async getDashboardOverview() {
    return mockDashboard;
  }

  async listKnowledgeBases() {
    return page(mockKnowledgeBases);
  }

  async listDocuments() {
    return page(mockDocuments);
  }

  async chat(input: ChatRequest): Promise<ChatResponse> {
    const conversationId = input.conversationId ?? 'conv_1';
    const answer = '默认使用顶层静态 import；动态导入只用于代码分割或浏览器专属重资产加载。';
    return {
      conversationId,
      answer,
      traceId: mockTraceDetail.id,
      citations: mockTraceDetail.citations,
      userMessage: {
        id: 'msg_user',
        conversationId,
        role: 'user',
        content: input.message,
        createdAt: new Date().toISOString()
      },
      assistantMessage: {
        id: 'msg_assistant',
        conversationId,
        role: 'assistant',
        content: answer,
        traceId: mockTraceDetail.id,
        citations: mockTraceDetail.citations,
        createdAt: new Date().toISOString()
      }
    };
  }

  async getTrace() {
    return { trace: mockTraceDetail };
  }

  async listTraces() {
    return page([mockTraceDetail]);
  }

  async listEvalDatasets() {
    return page(mockEvalDatasets);
  }

  async listEvalRuns() {
    return page(mockEvalRuns);
  }
}

function page<T>(items: T[]): PageResult<T> {
  return { items, total: items.length, page: 1, pageSize: 20 };
}
