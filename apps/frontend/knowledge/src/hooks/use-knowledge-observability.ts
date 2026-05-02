import { useCallback, useEffect, useRef, useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
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

export function useKnowledgeObservability(): KnowledgeObservabilityResult {
  const api = useKnowledgeApi();
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const traceRequestIdRef = useRef(0);
  const selectedTraceIdRef = useRef<string | null>(null);
  const [state, setState] = useState<KnowledgeObservabilityState>({
    loading: true,
    error: null,
    metrics: null,
    traces: [],
    trace: null,
    traceLoading: false,
    traceError: null
  });

  const selectTrace = useCallback(
    async (traceId: string) => {
      const requestId = traceRequestIdRef.current + 1;
      traceRequestIdRef.current = requestId;
      selectedTraceIdRef.current = traceId;
      if (!mountedRef.current) {
        return;
      }
      setState(current => ({ ...current, traceLoading: true, traceError: null }));
      try {
        const trace = await api.getTrace(traceId);
        if (!mountedRef.current || requestId !== traceRequestIdRef.current) {
          return;
        }
        setState(current => ({ ...current, trace, traceLoading: false, traceError: null }));
      } catch (error) {
        if (!mountedRef.current || requestId !== traceRequestIdRef.current) {
          return;
        }
        setState(current => ({ ...current, traceLoading: false, traceError: toError(error) }));
      }
    },
    [api]
  );

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    traceRequestIdRef.current += 1;
    const traceRequestId = traceRequestIdRef.current;
    if (!mountedRef.current) {
      return;
    }
    setState(current => ({ ...current, loading: true, error: null, traceError: null }));
    try {
      const [metrics, traces] = await Promise.all([api.getObservabilityMetrics(), api.listTraces()]);
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      const selectedTraceId = selectedTraceIdRef.current;
      const firstTraceId = selectedTraceId
        ? (traces.items.find(item => item.id === selectedTraceId)?.id ?? selectedTraceId)
        : traces.items[0]?.id;
      let trace: RagTraceDetail | null = null;
      let traceError: Error | null = null;
      if (firstTraceId) {
        try {
          trace = await api.getTrace(firstTraceId);
        } catch (error) {
          traceError = toError(error);
        }
      }
      const shouldApplyTrace = traceRequestId === traceRequestIdRef.current;
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState(current => ({
        loading: false,
        error: null,
        metrics,
        traces: traces.items,
        trace: shouldApplyTrace ? trace : current.trace,
        traceLoading: false,
        traceError: shouldApplyTrace ? traceError : current.traceError
      }));
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState(current => ({ ...current, loading: false, traceLoading: false, error: toError(error) }));
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

  return { ...state, reload, selectTrace };
}
