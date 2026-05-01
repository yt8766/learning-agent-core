// apps/frontend/agent-admin/src/features/workflow-lab/hooks/useWorkflowStream.ts
import { useEffect, useState } from 'react';

import type { WorkflowNodeTrace } from '../api/workflow-runs.api';

export type RunStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface StreamNodeEvent extends WorkflowNodeTrace {
  receivedAt: number | string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

type WorkflowNodeStreamPayload = Omit<WorkflowNodeTrace, 'inputSnapshot' | 'outputSnapshot'> & {
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
};

function normalizeNodePayload(payload: WorkflowNodeStreamPayload): WorkflowNodeTrace {
  return {
    nodeId: payload.nodeId,
    status: payload.status,
    durationMs: payload.durationMs,
    inputSnapshot: payload.inputSnapshot ?? payload.input ?? {},
    outputSnapshot: payload.outputSnapshot ?? payload.output ?? {},
    errorMessage: payload.errorMessage
  };
}

export function useWorkflowStream(runId: string | null) {
  const [nodes, setNodes] = useState<StreamNodeEvent[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');

  useEffect(() => {
    if (!runId) {
      setNodes([]);
      setRunStatus('idle');
      return;
    }

    setNodes([]);
    setRunStatus('running');

    const es = new EventSource(`${API_BASE}/workflow-runs/${runId}/stream`);
    const markFailed = () => {
      setRunStatus('failed');
      es.close();
    };

    es.addEventListener('node-complete', (e: MessageEvent) => {
      const data = normalizeNodePayload(JSON.parse(e.data as string) as WorkflowNodeStreamPayload);
      setNodes(prev => [...prev, { ...data, receivedAt: Date.now() }]);
    });

    es.addEventListener('run-complete', (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as { status: string };
      setRunStatus(data.status === 'completed' ? 'completed' : 'failed');
      es.close();
    });

    es.addEventListener('run-error', markFailed);
    es.addEventListener('error', markFailed);
    es.onerror = markFailed;

    return () => {
      es.close();
    };
  }, [runId]);

  return { nodes, runStatus };
}
