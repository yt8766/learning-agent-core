import { Injectable, NotFoundException } from '@nestjs/common';

import type { KnowledgeTraceRecord, KnowledgeTraceStatus } from './interfaces/knowledge-records.types';
import type {
  KnowledgeObservabilityMetricsDto,
  KnowledgeObservabilityQuery,
  KnowledgePageDto,
  KnowledgeRetrievalHitPreviewDto,
  KnowledgeRetrievalSnapshotDto,
  KnowledgeStageLatencyMetric,
  KnowledgeTraceCitationDto,
  KnowledgeTraceDetailDto,
  KnowledgeTraceDetailQuery,
  KnowledgeTraceListItemDto,
  KnowledgeTraceSpanDto
} from './interfaces/knowledge-observability.types';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

const NO_EVIDENCE_ANSWER = '未在当前知识库中找到足够依据。';

export interface KnowledgeObservabilityServiceDeps {
  repo: KnowledgeRepository;
}

@Injectable()
export class KnowledgeObservabilityService {
  constructor(private readonly deps: KnowledgeObservabilityServiceDeps) {}

  async getMetrics(query: KnowledgeObservabilityQuery): Promise<KnowledgeObservabilityMetricsDto> {
    const traces = await this.listRepositoryTraces(query);
    const latencies = traces.map(trace => trace.latencyMs).filter(isNumber);

    return {
      traceCount: traces.length,
      questionCount: traces.length,
      averageLatencyMs: average(latencies),
      p95LatencyMs: nearestRank(latencies, 0.95),
      p99LatencyMs: nearestRank(latencies, 0.99),
      errorRate: rate(traces, trace => trace.status === 'failed'),
      timeoutRate: rate(traces, isTimeoutTrace),
      noAnswerRate: rate(traces, isNoAnswerTrace),
      negativeFeedbackRate: 0,
      citationClickRate: 0,
      stageLatency: projectStageLatency(traces)
    };
  }

  async listTraces(query: KnowledgeObservabilityQuery): Promise<KnowledgePageDto<KnowledgeTraceListItemDto>> {
    const traces = await this.listRepositoryTraces(query);
    const items = traces.map(projectTraceListItem);
    return page(items);
  }

  async getTrace(query: KnowledgeTraceDetailQuery): Promise<KnowledgeTraceDetailDto> {
    const trace = await this.deps.repo.getTrace({ tenantId: query.tenantId, id: query.id });
    if (!trace || (query.knowledgeBaseId && !trace.knowledgeBaseIds.includes(query.knowledgeBaseId))) {
      throw new NotFoundException('knowledge trace not found');
    }

    const item = projectTraceListItem(trace);
    const citations = projectCitationSummaries(trace.metadata);
    return {
      ...item,
      spans: projectSpans(trace),
      citations,
      retrievalSnapshot: projectRetrievalSnapshot(citations)
    };
  }

  private async listRepositoryTraces(query: KnowledgeObservabilityQuery): Promise<KnowledgeTraceRecord[]> {
    const result = await this.deps.repo.listTraces({
      tenantId: query.tenantId,
      knowledgeBaseId: query.knowledgeBaseId,
      operation: 'rag.chat'
    });
    return result.items;
  }
}

function projectTraceListItem(trace: KnowledgeTraceRecord): KnowledgeTraceListItemDto {
  const citationCount = projectCitationSummaries(trace.metadata).length;
  return {
    id: trace.id,
    workspaceId: trace.tenantId,
    conversationId: trace.conversationId,
    messageId: trace.messageId,
    knowledgeBaseIds: trace.knowledgeBaseIds,
    question: metadataString(trace.metadata, 'questionPreview') ?? '',
    answer: metadataString(trace.metadata, 'answerPreview'),
    status: trace.status,
    latencyMs: trace.latencyMs,
    hitCount: citationCount,
    citationCount,
    createdBy: metadataString(trace.metadata, 'createdBy'),
    createdAt: trace.createdAt
  };
}

function projectSpans(trace: KnowledgeTraceRecord): KnowledgeTraceSpanDto[] {
  return (trace.spans ?? []).flatMap((span, index) => {
    if (!isPlainRecord(span)) {
      return [];
    }

    const name = stringValue(span.name) ?? stringValue(span.stage) ?? `span-${index + 1}`;
    const stage = stringValue(span.stage) ?? name;
    const status = traceStatusValue(span.status) ?? trace.status;
    const projected: KnowledgeTraceSpanDto = {
      id: stringValue(span.id) ?? `${trace.id}-${stage}-${index + 1}`,
      traceId: trace.id,
      stage,
      name,
      status
    };
    const latencyMs = numberValue(span.latencyMs);
    if (latencyMs !== undefined) {
      projected.latencyMs = latencyMs;
    }
    const startedAt = stringValue(span.startedAt);
    if (startedAt !== undefined) {
      projected.startedAt = startedAt;
    }
    const endedAt = stringValue(span.endedAt);
    if (endedAt !== undefined) {
      projected.endedAt = endedAt;
    }
    return [projected];
  });
}

function projectCitationSummaries(metadata: Record<string, unknown> | undefined): KnowledgeTraceCitationDto[] {
  if (!isPlainRecord(metadata) || !Array.isArray(metadata.citationSummaries)) {
    return [];
  }

  return metadata.citationSummaries.flatMap(summary => {
    if (!isPlainRecord(summary)) {
      return [];
    }
    const chunkId = stringValue(summary.chunkId);
    const documentId = stringValue(summary.documentId);
    if (!chunkId || !documentId) {
      return [];
    }

    const title = stringValue(summary.title) ?? documentId;
    const textPreview = stringValue(summary.textPreview) ?? '';
    const projected: KnowledgeTraceCitationDto = {
      id: `cite_${chunkId}`,
      chunkId,
      documentId,
      title,
      quote: textPreview,
      text: textPreview,
      contentPreview: textPreview,
      metadata: { title }
    };
    const score = numberValue(summary.score);
    if (score !== undefined) {
      projected.score = score;
    }
    const rank = numberValue(summary.rank);
    if (rank !== undefined) {
      projected.rank = rank;
    }
    return [projected];
  });
}

function projectRetrievalSnapshot(
  citations: readonly KnowledgeTraceCitationDto[]
): KnowledgeRetrievalSnapshotDto | undefined {
  if (citations.length === 0) {
    return undefined;
  }

  const selectedChunks: KnowledgeRetrievalHitPreviewDto[] = citations.map((citation, index) => ({
    chunkId: citation.chunkId,
    documentId: citation.documentId,
    title: citation.title,
    contentPreview: citation.contentPreview ?? citation.quote,
    score: citation.score,
    rank: citation.rank ?? index + 1
  }));
  return {
    vectorHits: [],
    keywordHits: [],
    mergedHits: [],
    rerankedHits: [],
    selectedChunks
  };
}

function projectStageLatency(traces: readonly KnowledgeTraceRecord[]): KnowledgeStageLatencyMetric[] {
  const byStage = new Map<string, number[]>();
  for (const trace of traces) {
    for (const span of trace.spans ?? []) {
      if (!isPlainRecord(span)) {
        continue;
      }
      const stage = stringValue(span.stage) ?? stringValue(span.name);
      const latencyMs = numberValue(span.latencyMs);
      if (!stage || latencyMs === undefined) {
        continue;
      }
      const values = byStage.get(stage) ?? [];
      values.push(latencyMs);
      byStage.set(stage, values);
    }
  }

  return [...byStage.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([stage, values]) => ({
      stage,
      averageLatencyMs: average(values),
      p95LatencyMs: nearestRank(values, 0.95)
    }));
}

function isTimeoutTrace(trace: KnowledgeTraceRecord): boolean {
  const haystack = `${trace.errorMessage ?? ''} ${JSON.stringify(trace.spans ?? [])}`.toLowerCase();
  return haystack.includes('timeout') || haystack.includes('timed out');
}

function isNoAnswerTrace(trace: KnowledgeTraceRecord): boolean {
  const answer = metadataString(trace.metadata, 'answerPreview');
  return (
    trace.status === 'succeeded' && (answer === undefined || answer.trim() === '' || answer === NO_EVIDENCE_ANSWER)
  );
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  return isPlainRecord(metadata) ? stringValue(metadata[key]) : undefined;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function nearestRank(values: readonly number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function rate<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  if (items.length === 0) {
    return 0;
  }
  return round(items.filter(predicate).length / items.length);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function traceStatusValue(value: unknown): KnowledgeTraceStatus | undefined {
  return value === 'running' || value === 'succeeded' || value === 'failed' || value === 'canceled' ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function page<T>(items: T[]): KnowledgePageDto<T> {
  return { items, total: items.length, page: 1, pageSize: 20 };
}
