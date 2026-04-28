import type { RuntimeProfile } from '@agent/config';
import type { ChatCheckpointRecord, ChatSessionRecord } from '@agent/core';
import type { ApprovalScopePolicyRecord } from '@agent/runtime';
import {
  buildRuntimeCenterProjection,
  buildRuntimeCenterSummaryProjection,
  summarizeAndPersistUsageAnalytics,
  type RuntimeCenterTaskLike
} from '../core/runtime-centers-facade';
import { getMinistryDisplayName, getSpecialistDisplayName } from '../helpers/runtime-architecture-helpers';

import { deriveRecentAgentErrors } from '../helpers/runtime-agent-errors';
import type { DailyTechBriefingStatusRecord } from '../briefings/runtime-tech-briefing.types';
export { buildRuntimeCenterSummaryProjection as buildRuntimeCenterSummary } from '../core/runtime-centers-facade';
export type { RuntimeCenterTaskLike } from '../core/runtime-centers-facade';
import type { RuntimeHost } from '../core/runtime.host';

export function buildRuntimeCenter(input: {
  profile: RuntimeProfile;
  policy: {
    approvalMode: 'strict' | 'balanced' | 'auto';
    skillInstallMode: 'manual' | 'low-risk-auto';
    learningMode: 'controlled' | 'aggressive';
    sourcePolicyMode: 'internal-only' | 'controlled-first' | 'open-web-allowed';
    budget: {
      stepBudget: number;
      retryBudget: number;
      sourceBudget: number;
    };
  };
  tasks: RuntimeCenterTaskLike[];
  sessions: ChatSessionRecord[];
  pendingApprovals: Array<{ id: string }>;
  usageAnalytics: Awaited<ReturnType<typeof summarizeAndPersistUsageAnalytics>>;
  recentGovernanceAudit?: Array<{
    id: string;
    at: string;
    actor: string;
    action: string;
    scope:
      | 'skill-source'
      | 'company-worker'
      | 'skill-install'
      | 'connector'
      | 'approval-policy'
      | 'counselor-selector'
      | 'learning-conflict';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }>;
  approvalScopePolicies?: ApprovalScopePolicyRecord[];
  backgroundWorkerPoolSize: number;
  backgroundWorkerSlots: Map<string, { taskId: string; startedAt: string }>;
  filteredRecentRuns: RuntimeCenterTaskLike[];
  getCheckpoint: (sessionId: string) => ChatCheckpointRecord | undefined;
  runtimeHost: Pick<RuntimeHost, 'listSubgraphDescriptors' | 'listWorkflowVersions'>;
  knowledgeOverview?: {
    stores: Array<{
      id: string;
      store: 'wenyuan' | 'cangjing';
      displayName: string;
      summary: string;
      rootPath?: string;
      status: 'active' | 'degraded' | 'readonly';
      updatedAt: string;
    }>;
    searchableDocumentCount: number;
    blockedDocumentCount: number;
    sourceCount: number;
    chunkCount: number;
    embeddingCount: number;
    latestReceipts: Array<{
      id: string;
      sourceId: string;
      status: 'completed' | 'partial' | 'failed';
      chunkCount: number;
      embeddedChunkCount: number;
      updatedAt: string;
    }>;
  };
  dailyTechBriefing?: DailyTechBriefingStatusRecord;
}) {
  return buildRuntimeCenterProjection({
    ...input,
    getMinistryDisplayName,
    getSpecialistDisplayName,
    deriveRecentAgentErrors,
    listSubgraphDescriptors: () => input.runtimeHost.listSubgraphDescriptors(),
    listWorkflowVersions: () => input.runtimeHost.listWorkflowVersions()
  });
}
