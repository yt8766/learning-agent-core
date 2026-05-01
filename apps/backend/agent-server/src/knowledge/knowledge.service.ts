import { Injectable, UnauthorizedException } from '@nestjs/common';

import { knowledgeApiFixtures } from './knowledge-api-fixtures';
import { createKnowledgeAccessToken, createKnowledgeRefreshToken, parseKnowledgeRefreshToken } from './knowledge-jwt';

export interface KnowledgeLoginRequest {
  email: string;
  password: string;
}

export interface KnowledgeRefreshRequest {
  refreshToken: string;
}

@Injectable()
export class KnowledgeService {
  async login(input: KnowledgeLoginRequest) {
    if (!input.email || !input.password) {
      throw new UnauthorizedException({ code: 'auth_invalid_credentials', message: 'Invalid credentials' });
    }
    const user = this.getStubUser(input.email);
    return {
      user,
      tokens: {
        accessToken: createKnowledgeAccessToken(user.id),
        refreshToken: createKnowledgeRefreshToken(user.id),
        tokenType: 'Bearer' as const,
        expiresIn: 7200,
        refreshExpiresIn: 1209600
      }
    };
  }

  async refresh(input: KnowledgeRefreshRequest) {
    const parsed = parseKnowledgeRefreshToken(input.refreshToken);
    if (!parsed) {
      throw new UnauthorizedException({ code: 'auth_refresh_token_invalid', message: 'Invalid refresh token' });
    }
    return {
      tokens: {
        accessToken: createKnowledgeAccessToken(parsed.userId, parsed.version + 1),
        refreshToken: createKnowledgeRefreshToken(parsed.userId, parsed.version + 1),
        tokenType: 'Bearer' as const,
        expiresIn: 7200,
        refreshExpiresIn: 1209600
      }
    };
  }

  async me() {
    return {
      user: this.getStubUser('dev@example.com')
    };
  }

  getDashboardOverview() {
    return knowledgeApiFixtures.dashboard;
  }

  listKnowledgeBases() {
    return knowledgeApiFixtures.knowledgeBases;
  }

  getKnowledgeBase(id: string) {
    return (
      knowledgeApiFixtures.knowledgeBases.items.find(item => item.id === id) ??
      knowledgeApiFixtures.knowledgeBases.items[0]
    );
  }

  listDocuments() {
    return knowledgeApiFixtures.documents;
  }

  getDocument(id: string) {
    return knowledgeApiFixtures.documents.items.find(item => item.id === id) ?? knowledgeApiFixtures.documents.items[0];
  }

  listDocumentJobs() {
    return page(knowledgeApiFixtures.jobs);
  }

  listDocumentChunks() {
    return knowledgeApiFixtures.chunks;
  }

  chat(input: { conversationId?: string; message?: string }) {
    return {
      ...knowledgeApiFixtures.chatResponse,
      conversationId: input.conversationId ?? knowledgeApiFixtures.chatResponse.conversationId,
      userMessage: {
        ...knowledgeApiFixtures.chatResponse.userMessage,
        conversationId: input.conversationId ?? knowledgeApiFixtures.chatResponse.conversationId,
        content: input.message ?? knowledgeApiFixtures.chatResponse.userMessage.content
      },
      assistantMessage: {
        ...knowledgeApiFixtures.chatResponse.assistantMessage,
        conversationId: input.conversationId ?? knowledgeApiFixtures.chatResponse.conversationId
      }
    };
  }

  createFeedback(messageId: string, input: { rating?: 'positive' | 'negative'; category?: string; comment?: string }) {
    return {
      ...knowledgeApiFixtures.chatResponse.assistantMessage,
      id: messageId,
      feedback: {
        rating: input.rating ?? 'negative',
        category: input.category
      }
    };
  }

  getObservabilityMetrics() {
    return {
      traceCount: 1,
      questionCount: knowledgeApiFixtures.dashboard.todayQuestionCount,
      averageLatencyMs: knowledgeApiFixtures.dashboard.averageLatencyMs,
      p95LatencyMs: knowledgeApiFixtures.dashboard.p95LatencyMs,
      p99LatencyMs: knowledgeApiFixtures.dashboard.p99LatencyMs,
      errorRate: knowledgeApiFixtures.dashboard.errorRate,
      timeoutRate: 0,
      noAnswerRate: knowledgeApiFixtures.dashboard.noAnswerRate,
      negativeFeedbackRate: knowledgeApiFixtures.dashboard.negativeFeedbackRate,
      citationClickRate: 0.42,
      stageLatency: [
        { stage: 'embedding', averageLatencyMs: 100, p95LatencyMs: 130 },
        { stage: 'vector_search', averageLatencyMs: 120, p95LatencyMs: 160 },
        { stage: 'generation', averageLatencyMs: 600, p95LatencyMs: 820 }
      ]
    };
  }

  listTraces() {
    return page([
      {
        id: knowledgeApiFixtures.traceDetail.id,
        workspaceId: knowledgeApiFixtures.traceDetail.workspaceId,
        conversationId: knowledgeApiFixtures.traceDetail.conversationId,
        messageId: knowledgeApiFixtures.traceDetail.messageId,
        knowledgeBaseIds: knowledgeApiFixtures.traceDetail.knowledgeBaseIds,
        question: knowledgeApiFixtures.traceDetail.question,
        answer: knowledgeApiFixtures.traceDetail.answer,
        status: knowledgeApiFixtures.traceDetail.status,
        latencyMs: knowledgeApiFixtures.traceDetail.latencyMs,
        hitCount: knowledgeApiFixtures.traceDetail.hitCount,
        citationCount: knowledgeApiFixtures.traceDetail.citationCount,
        createdBy: knowledgeApiFixtures.traceDetail.createdBy,
        createdAt: knowledgeApiFixtures.traceDetail.createdAt
      }
    ]);
  }

  getTrace() {
    return knowledgeApiFixtures.traceDetail;
  }

  listEvalDatasets() {
    return knowledgeApiFixtures.evalDatasets;
  }

  listEvalRuns() {
    return knowledgeApiFixtures.evalRuns;
  }

  getEvalRun(id: string) {
    return knowledgeApiFixtures.evalRuns.items.find(item => item.id === id) ?? knowledgeApiFixtures.evalRuns.items[0];
  }

  listEvalRunResults() {
    return knowledgeApiFixtures.evalResults;
  }

  private getStubUser(email: string) {
    return {
      id: 'user_1',
      email,
      name: 'Knowledge User',
      currentWorkspaceId: 'ws_1',
      roles: ['owner'],
      permissions: ['knowledge:read', 'knowledge:write', 'document:upload', 'chat:write', 'eval:run', 'trace:read']
    };
  }
}

function page<T>(items: readonly T[]) {
  return { items, total: items.length, page: 1, pageSize: 20 };
}
