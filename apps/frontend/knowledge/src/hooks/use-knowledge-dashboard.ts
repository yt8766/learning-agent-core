import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import { KNOWLEDGE_QUERY_STALE_TIME_MS, knowledgeQueryKeys } from '../api/knowledge-query';
import type { DashboardOverview, KnowledgeBase } from '../types/api';

interface KnowledgeDashboardState {
  loading: boolean;
  error: Error | null;
  overview: DashboardOverview | null;
  knowledgeBases: KnowledgeBase[];
}

export interface KnowledgeDashboardResult extends KnowledgeDashboardState {
  reload(): Promise<void>;
}

const DASHBOARD_QUERY_KEY = knowledgeQueryKeys.dashboard();
const KNOWLEDGE_BASES_QUERY_KEY = knowledgeQueryKeys.knowledgeBases();

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useKnowledgeDashboard(): KnowledgeDashboardResult {
  const api = useKnowledgeApi();
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => api.getDashboardOverview(),
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const knowledgeBasesQuery = useQuery({
    queryKey: KNOWLEDGE_BASES_QUERY_KEY,
    queryFn: () => api.listKnowledgeBases(),
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const { refetch: refetchOverview } = overviewQuery;
  const { refetch: refetchKnowledgeBases } = knowledgeBasesQuery;

  const reload = useCallback(async () => {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: DASHBOARD_QUERY_KEY }),
      queryClient.cancelQueries({ queryKey: KNOWLEDGE_BASES_QUERY_KEY })
    ]);
    await Promise.all([refetchOverview(), refetchKnowledgeBases()]);
  }, [queryClient, refetchKnowledgeBases, refetchOverview]);

  return {
    loading: overviewQuery.isFetching || knowledgeBasesQuery.isFetching,
    error: toErrorOrNull(overviewQuery.error ?? knowledgeBasesQuery.error),
    overview: overviewQuery.data ?? null,
    knowledgeBases: knowledgeBasesQuery.data?.items ?? [],
    reload
  };
}

function toErrorOrNull(error: unknown): Error | null {
  return error ? toError(error) : null;
}
