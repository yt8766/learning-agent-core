import type {
  KnowledgeObservabilityMetrics,
  KnowledgePageResult,
  KnowledgeRagTrace,
  KnowledgeRagTraceDetail
} from '@agent/core';

export class KnowledgeObservabilityService {
  async getMetrics(): Promise<KnowledgeObservabilityMetrics> {
    return {
      averageLatencyMs: 0,
      citationClickRate: 0,
      errorRate: 0,
      negativeFeedbackRate: 0,
      noAnswerRate: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      questionCount: 0,
      stageLatency: [],
      timeoutRate: 0,
      traceCount: 0
    };
  }

  async listTraces(): Promise<KnowledgePageResult<KnowledgeRagTrace>> {
    return { items: [], page: 1, pageSize: 20, total: 0 };
  }

  async getTrace(traceId: string): Promise<KnowledgeRagTraceDetail> {
    return {
      id: traceId,
      question: '',
      answer: '',
      status: 'succeeded',
      knowledgeBaseIds: [],
      workspaceId: 'default',
      createdAt: new Date().toISOString(),
      spans: [],
      citations: []
    };
  }
}
