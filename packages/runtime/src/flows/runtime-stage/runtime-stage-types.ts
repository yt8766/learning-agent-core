import type { CurrentSkillExecutionRecord } from '@agent/core';
import { ApprovalDecision } from '@agent/core';
import type { AgentRoleValue as AgentRole } from '@agent/core';

import type { PendingExecutionContext } from '../approval';
import type { RuntimeTaskRecord as TaskRecord } from '../../runtime/runtime-task.types';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import type { ToolUsageSummaryRecord } from '@agent/runtime';

export interface PipelineRuntimeCallbacks {
  ensureTaskNotCancelled: (task: TaskRecord) => void;
  syncTaskRuntime: (
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) => void;
  markSubgraph: (task: TaskRecord, subgraphId: 'research' | 'execution') => void;
  markWorkerUsage: (task: TaskRecord, workerId?: string) => void;
  attachTool: (
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
  recordToolUsage: (
    task: TaskRecord,
    params: {
      toolName: string;
      status: ToolUsageSummaryRecord['status'];
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
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  setSubTaskStatus: (
    task: TaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  addMessage: (
    task: TaskRecord,
    type: 'research_result' | 'execution_result',
    content: string,
    from: AgentRole
  ) => void;
  upsertAgentState: (task: TaskRecord, nextState: unknown) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  updateBudgetState: (
    task: TaskRecord,
    overrides: Partial<NonNullable<TaskRecord['budgetState']>>
  ) => NonNullable<TaskRecord['budgetState']>;
  transitionQueueState: (
    task: TaskRecord,
    status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  ) => void;
  registerPendingExecution?: (taskId: string, pending: PendingExecutionContext) => void;
  resolveResearchMinistry: (
    task: TaskRecord,
    workflow?: TaskRecord['resolvedWorkflow']
  ) => 'hubu-search' | 'libu-delivery';
  resolveExecutionMinistry: (
    task: TaskRecord,
    workflow?: TaskRecord['resolvedWorkflow']
  ) => 'gongbu-code' | 'bingbu-ops' | 'libu-delivery';
  getMinistryLabel: (ministry: string) => string;
  describeActionIntent: (intent: string) => string;
  createAgentContext: (taskId: string, goal: string, flow: 'chat' | 'approval' | 'learning') => any;
  resolveRuntimeSkillIntervention?: (params: {
    task: TaskRecord;
    goal: string;
    currentStep: 'direct_reply' | 'research';
    skillSearch: NonNullable<TaskRecord['skillSearch']>;
    usedInstalledSkills?: string[];
  }) => Promise<
    | {
        skillSearch?: NonNullable<TaskRecord['skillSearch']>;
        usedInstalledSkills?: string[];
        progressSummary?: string;
        traceSummary?: string;
        pendingApproval?: {
          toolName: string;
          reason?: string;
          preview?: Array<{
            label: string;
            value: string;
          }>;
        };
        pendingExecution?: {
          receiptId: string;
          skillDisplayName?: string;
        };
      }
    | undefined
  >;
  resolveSkillInstallInterruptResume?: (params: {
    task: TaskRecord;
    receiptId: string;
    skillDisplayName?: string;
    usedInstalledSkills?: string[];
    actor?: string;
  }) => Promise<
    | {
        skillSearch?: NonNullable<TaskRecord['skillSearch']>;
        usedInstalledSkills?: string[];
        traceSummary?: string;
        progressSummary?: string;
      }
    | undefined
  >;
}
