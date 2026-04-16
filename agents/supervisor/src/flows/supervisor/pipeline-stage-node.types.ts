import type { AgentRole, TaskRecord } from '@agent/shared';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';

export interface PlanningCallbacks {
  ensureTaskNotCancelled: (task: TaskRecord) => void;
  syncTaskRuntime: (
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) => void;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  attachTool?: (
    task: TaskRecord,
    params: {
      toolName: string;
      attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
      preferred?: boolean;
      reason?: string;
      ownerType?: 'shared' | 'ministry-owned' | 'specialist-owned' | 'user-attached' | 'runtime-derived';
      ownerId?: string;
      family?: string;
    }
  ) => void;
  recordToolUsage?: (
    task: TaskRecord,
    params: {
      toolName: string;
      status: 'suggested' | 'used' | 'blocked' | 'approved' | 'rejected';
      requestedBy?: string;
      reason?: string;
      blockedReason?: string;
      serverId?: string;
      capabilityId?: string;
      approvalRequired?: boolean;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      route?: 'local' | 'mcp' | 'governance';
      family?: string;
      capabilityType?: 'local-tool' | 'mcp-capability' | 'governance-tool';
    }
  ) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  resolveWorkflowRoutes: (task: TaskRecord, workflow?: TaskRecord['resolvedWorkflow']) => TaskRecord['modelRoute'];
  markWorkerUsage: (task: TaskRecord, workerId?: string) => void;
  recordDispatches: (task: TaskRecord, dispatches: RuntimeAgentGraphState['dispatches']) => void;
}
