import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import { KNOWLEDGE_QUERY_STALE_TIME_MS, knowledgeQueryKeys } from '../api/knowledge-query';
import type { EvalDataset, EvalRun } from '../types/api';

interface KnowledgeEvalsState {
  loading: boolean;
  error: Error | null;
  datasets: EvalDataset[];
  runs: EvalRun[];
  comparisonText: string;
}

export interface KnowledgeEvalsResult extends KnowledgeEvalsState {
  reload(): Promise<void>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

const EMPTY_COMPARISON_TEXT = '至少需要两次运行后展示评测对比。';
const EVAL_DATASETS_QUERY_KEY = [...knowledgeQueryKeys.root(), 'evals', 'datasets'] as const;
const EVAL_RUNS_QUERY_KEY = [...knowledgeQueryKeys.root(), 'evals', 'runs'] as const;

export function useKnowledgeEvals(): KnowledgeEvalsResult {
  const api = useKnowledgeApi();
  const datasetsQuery = useQuery({
    queryKey: EVAL_DATASETS_QUERY_KEY,
    queryFn: () => api.listEvalDatasets(),
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const runsQuery = useQuery({
    queryKey: EVAL_RUNS_QUERY_KEY,
    queryFn: () => api.listEvalRuns(),
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const [candidateRun, baselineRun] = runsQuery.data?.items ?? [];
  const comparisonEnabled = Boolean(candidateRun && baselineRun);
  const comparisonQuery = useQuery({
    queryKey:
      candidateRun && baselineRun
        ? knowledgeQueryKeys.evalRunComparison({ baselineRunId: baselineRun.id, candidateRunId: candidateRun.id })
        : [...knowledgeQueryKeys.root(), 'evals', 'run-comparison', {}],
    queryFn: () => {
      if (!candidateRun || !baselineRun) {
        throw new Error('至少需要两次运行后展示评测对比。');
      }
      return api.compareEvalRuns({ baselineRunId: baselineRun.id, candidateRunId: candidateRun.id });
    },
    enabled: comparisonEnabled,
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const { refetch: refetchComparison } = comparisonQuery;
  const { refetch: refetchDatasets } = datasetsQuery;
  const { refetch: refetchRuns } = runsQuery;

  const reload = useCallback(async () => {
    await Promise.all([refetchDatasets(), refetchRuns(), comparisonEnabled ? refetchComparison() : Promise.resolve()]);
  }, [comparisonEnabled, refetchComparison, refetchDatasets, refetchRuns]);

  return {
    loading: datasetsQuery.isFetching || runsQuery.isFetching || (comparisonEnabled && comparisonQuery.isFetching),
    error: toErrorOrNull(datasetsQuery.error ?? runsQuery.error ?? comparisonQuery.error),
    datasets: datasetsQuery.data?.items ?? [],
    runs: runsQuery.data?.items ?? [],
    comparisonText: comparisonQuery.data
      ? `${comparisonQuery.data.candidateRunId} 相比 ${comparisonQuery.data.baselineRunId}：总分变化 ${comparisonQuery.data.totalScoreDelta}`
      : EMPTY_COMPARISON_TEXT,
    reload
  };
}

function toErrorOrNull(error: unknown): Error | null {
  return error ? toError(error) : null;
}
