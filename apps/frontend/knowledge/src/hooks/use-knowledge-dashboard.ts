import { useCallback, useEffect, useRef, useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
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

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useKnowledgeDashboard(): KnowledgeDashboardResult {
  const api = useKnowledgeApi();
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const [state, setState] = useState<KnowledgeDashboardState>({
    loading: true,
    error: null,
    overview: null,
    knowledgeBases: []
  });

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!mountedRef.current) {
      return;
    }
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const [overview, knowledgeBases] = await Promise.all([api.getDashboardOverview(), api.listKnowledgeBases()]);
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState({
        loading: false,
        error: null,
        overview,
        knowledgeBases: knowledgeBases.items
      });
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState(current => ({
        ...current,
        loading: false,
        error: toError(error)
      }));
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
