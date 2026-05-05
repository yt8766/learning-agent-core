import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import { KNOWLEDGE_QUERY_STALE_TIME_MS, knowledgeQueryKeys } from '../api/knowledge-query';
import type { ObservabilityMetrics, RagTrace, RagTraceDetail } from '../types/api';

interface KnowledgeObservabilityState {
  loading: boolean;
  error: Error | null;
  metrics: ObservabilityMetrics | null;
  traces: RagTrace[];
  trace: RagTraceDetail | null;
  traceLoading: boolean;
  traceError: Error | null;
}

export interface KnowledgeObservabilityResult extends KnowledgeObservabilityState {
  reload(): Promise<void>;
  selectTrace(traceId: string): Promise<void>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

const OBSERVABILITY_METRICS_QUERY_KEY = [...knowledgeQueryKeys.root(), 'observability', 'metrics'] as const;
const OBSERVABILITY_TRACES_QUERY_KEY = [...knowledgeQueryKeys.root(), 'observability', 'traces'] as const;

export function useKnowledgeObservability(): KnowledgeObservabilityResult {
  const api = useKnowledgeApi();
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const metricsQuery = useQuery({
    queryKey: OBSERVABILITY_METRICS_QUERY_KEY,
    queryFn: () => api.getObservabilityMetrics(),
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const tracesQuery = useQuery({
    queryKey: OBSERVABILITY_TRACES_QUERY_KEY,
    queryFn: () => api.listTraces(),
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const traceDetailId = selectedTraceId ?? tracesQuery.data?.items[0]?.id ?? null;
  const traceQuery = useQuery({
    queryKey: knowledgeQueryKeys.trace(traceDetailId ?? ''),
    queryFn: () => api.getTrace(traceDetailId ?? ''),
    enabled: Boolean(traceDetailId),
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const { refetch: refetchMetrics } = metricsQuery;
  const { refetch: refetchTrace } = traceQuery;
  const { refetch: refetchTraces } = tracesQuery;

  const selectTrace = useCallback(async (traceId: string) => {
    setSelectedTraceId(traceId);
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([refetchMetrics(), refetchTraces(), traceDetailId ? refetchTrace() : Promise.resolve()]);
  }, [refetchMetrics, refetchTrace, refetchTraces, traceDetailId]);

  return {
    loading: metricsQuery.isFetching || tracesQuery.isFetching,
    error: toErrorOrNull(metricsQuery.error ?? tracesQuery.error),
    metrics: metricsQuery.data ?? null,
    traces: tracesQuery.data?.items ?? [],
    trace: traceQuery.data ?? null,
    traceLoading: traceQuery.isFetching,
    traceError: toErrorOrNull(traceQuery.error),
    reload,
    selectTrace
  };
}

function toErrorOrNull(error: unknown): Error | null {
  return error ? toError(error) : null;
}
