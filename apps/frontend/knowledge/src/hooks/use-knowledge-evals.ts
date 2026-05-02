import { useCallback, useEffect, useRef, useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
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

export function useKnowledgeEvals(): KnowledgeEvalsResult {
  const api = useKnowledgeApi();
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const [state, setState] = useState<KnowledgeEvalsState>({
    loading: true,
    error: null,
    datasets: [],
    runs: [],
    comparisonText: '至少需要两次运行后展示评测对比。'
  });

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!mountedRef.current) {
      return;
    }
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const [datasets, runs] = await Promise.all([api.listEvalDatasets(), api.listEvalRuns()]);
      const [candidateRun, baselineRun] = runs.items;
      const comparison =
        candidateRun && baselineRun
          ? await api.compareEvalRuns({ baselineRunId: baselineRun.id, candidateRunId: candidateRun.id })
          : null;
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState({
        loading: false,
        error: null,
        datasets: datasets.items,
        runs: runs.items,
        comparisonText: comparison
          ? `${comparison.candidateRunId} 相比 ${comparison.baselineRunId}：总分变化 ${comparison.totalScoreDelta}`
          : '至少需要两次运行后展示评测对比。'
      });
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState(current => ({ ...current, loading: false, error: toError(error) }));
    }
  }, [api]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
