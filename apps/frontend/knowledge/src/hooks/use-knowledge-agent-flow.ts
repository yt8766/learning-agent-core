import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import type { AgentFlowRecord, AgentFlowRunRequest, AgentFlowRunResponse } from '../types/api';

const DEFAULT_AGENT_FLOW_MESSAGE = '验证知识库智能代理流程';

export function useKnowledgeAgentFlow() {
  const api = useKnowledgeApi();
  const [flows, setFlows] = useState<AgentFlowRecord[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRun, setLastRun] = useState<AgentFlowRunResponse | null>(null);
  const mountedRef = useRef(true);
  const reloadRequestIdRef = useRef(0);
  const saveRequestIdRef = useRef(0);
  const runRequestIdRef = useRef(0);

  const activeFlow = useMemo(() => flows.find(flow => flow.id === activeFlowId) ?? flows[0], [activeFlowId, flows]);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const reload = useCallback(async () => {
    const requestId = reloadRequestIdRef.current + 1;
    reloadRequestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const result = await api.listAgentFlows();
      if (isCurrentRequest(mountedRef, reloadRequestIdRef, requestId)) {
        setFlows(result.items);
        setActiveFlowId(current => current ?? result.items[0]?.id);
      }
    } catch (caught) {
      if (isCurrentRequest(mountedRef, reloadRequestIdRef, requestId)) {
        setError(toError(caught));
      }
    } finally {
      if (isCurrentRequest(mountedRef, reloadRequestIdRef, requestId)) {
        setLoading(false);
      }
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveFlow = useCallback(
    async (flow: AgentFlowRecord = activeFlow!) => {
      if (!flow) {
        return undefined;
      }
      const requestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = requestId;
      setSaving(true);
      setError(null);
      try {
        const response = flows.some(item => item.id === flow.id)
          ? await api.updateAgentFlow(flow.id, { flow })
          : await api.saveAgentFlow({ flow });
        if (isCurrentRequest(mountedRef, saveRequestIdRef, requestId)) {
          setFlows(current => upsertFlow(current, response.flow));
          setActiveFlowId(response.flow.id);
        }
        return response.flow;
      } catch (caught) {
        if (isCurrentRequest(mountedRef, saveRequestIdRef, requestId)) {
          setError(toError(caught));
        }
        return undefined;
      } finally {
        if (isCurrentRequest(mountedRef, saveRequestIdRef, requestId)) {
          setSaving(false);
        }
      }
    },
    [activeFlow, api, flows]
  );

  const runFlow = useCallback(async () => {
    if (!activeFlow) {
      return undefined;
    }
    const requestId = runRequestIdRef.current + 1;
    runRequestIdRef.current = requestId;
    setRunning(true);
    setError(null);
    try {
      const runRequest: AgentFlowRunRequest = {
        flowId: activeFlow.id,
        input: {
          knowledgeBaseIds: [],
          message: DEFAULT_AGENT_FLOW_MESSAGE,
          variables: {}
        }
      };
      const response = await api.runAgentFlow(activeFlow.id, runRequest);
      if (isCurrentRequest(mountedRef, runRequestIdRef, requestId)) {
        setLastRun(response);
      }
      return response;
    } catch (caught) {
      if (isCurrentRequest(mountedRef, runRequestIdRef, requestId)) {
        setError(toError(caught));
      }
      return undefined;
    } finally {
      if (isCurrentRequest(mountedRef, runRequestIdRef, requestId)) {
        setRunning(false);
      }
    }
  }, [activeFlow, api]);

  return {
    activeFlow,
    activeFlowId,
    error,
    flows,
    lastRun,
    loading,
    reload,
    runFlow,
    running,
    saveFlow,
    saving,
    setActiveFlowId
  };
}

function upsertFlow(flows: AgentFlowRecord[], flow: AgentFlowRecord): AgentFlowRecord[] {
  const next = flows.filter(item => item.id !== flow.id);
  next.unshift(flow);
  return next;
}

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

function isCurrentRequest(mountedRef: RefObject<boolean>, requestIdRef: RefObject<number>, requestId: number): boolean {
  return mountedRef.current && requestIdRef.current === requestId;
}
