import { loadSettings } from '@agent/config';
import { RequestedExecutionHints, SkillSearchStateRecord, CapabilityOwnerType, SpecialistDomain } from '@agent/core';
import type { EvidenceRecord } from '@agent/memory';
import type { SubgraphIdValue as SubgraphId } from '../task-architecture-helpers';
import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';
import type { ToolUsageSummaryRecord } from '@agent/runtime';

export type RuntimeSettings = ReturnType<typeof loadSettings>;

export interface KnowledgeReuseResult {
  memories: Array<{ tags: string[] }>;
  reusedMemoryIds: string[];
  reusedRuleIds: string[];
  evidence: EvidenceRecord[];
}

export type LocalSkillSuggestionResolver = (params: {
  goal: string;
  usedInstalledSkills?: string[];
  requestedHints?: RequestedExecutionHints;
  specialistDomain?: SpecialistDomain;
}) => Promise<SkillSearchStateRecord>;

export type PreExecutionSkillInterventionResolver = (params: {
  goal: string;
  taskId: string;
  runId: string;
  sessionId?: string;
  skillSearch: SkillSearchStateRecord;
  usedInstalledSkills?: string[];
}) => Promise<
  | {
      skillSearch?: SkillSearchStateRecord;
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

export interface TaskFactoryRuntimeCallbacks {
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string) => void;
  markSubgraph: (task: TaskRecord, subgraphId: SubgraphId) => void;
  attachTool: (
    task: TaskRecord,
    params: {
      toolName: string;
      attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
      preferred?: boolean;
      reason?: string;
      ownerType?: CapabilityOwnerType;
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
      riskLevel?: ToolUsageSummaryRecord['riskLevel'];
      route?: ToolUsageSummaryRecord['route'];
      family?: string;
      capabilityType?: ToolUsageSummaryRecord['capabilityType'];
    }
  ) => void;
}
