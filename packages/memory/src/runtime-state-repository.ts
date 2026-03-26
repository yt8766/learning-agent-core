import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import {
  ActionIntent,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  ConfiguredConnectorRecord,
  ConnectorDiscoveryHistoryRecord,
  LearningJob,
  TaskRecord
} from '@agent/shared';

export interface PendingExecutionRecord {
  taskId: string;
  intent: ActionIntent;
  toolName: string;
  researchSummary: string;
}

export interface RuntimeStateSnapshot {
  tasks: TaskRecord[];
  learningJobs: LearningJob[];
  pendingExecutions: PendingExecutionRecord[];
  chatSessions: ChatSessionRecord[];
  chatMessages: ChatMessageRecord[];
  chatEvents: ChatEventRecord[];
  chatCheckpoints: ChatCheckpointRecord[];
  governance?: {
    disabledSkillSourceIds?: string[];
    disabledCompanyWorkerIds?: string[];
    disabledConnectorIds?: string[];
    configuredConnectors?: ConfiguredConnectorRecord[];
    connectorDiscoveryHistory?: ConnectorDiscoveryHistoryRecord[];
    connectorPolicyOverrides?: Array<{
      connectorId: string;
      effect: 'allow' | 'deny' | 'require-approval' | 'observe';
      reason?: string;
      updatedAt: string;
      updatedBy?: string;
    }>;
    capabilityPolicyOverrides?: Array<{
      capabilityId: string;
      connectorId: string;
      effect: 'allow' | 'deny' | 'require-approval' | 'observe';
      reason?: string;
      updatedAt: string;
      updatedBy?: string;
    }>;
  };
  governanceAudit?: Array<{
    id: string;
    at: string;
    actor: string;
    action: string;
    scope: 'skill-source' | 'company-worker' | 'skill-install' | 'connector';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }>;
  usageHistory?: Array<{
    day: string;
    tokens: number;
    costUsd: number;
    costCny: number;
    runs: number;
    overBudget?: boolean;
    measuredRunCount?: number;
    estimatedRunCount?: number;
    updatedAt: string;
  }>;
  evalHistory?: Array<{
    day: string;
    runCount: number;
    passCount: number;
    passRate: number;
    scenarioCount: number;
    overallPassRate: number;
    updatedAt: string;
  }>;
  usageAudit?: Array<{
    taskId: string;
    day: string;
    modelBreakdown: Array<{
      model: string;
      totalTokens: number;
      costUsd: number;
      costCny: number;
      pricingSource?: 'provider' | 'estimated';
      callCount: number;
    }>;
    totalTokens: number;
    totalCostUsd: number;
    totalCostCny: number;
    measuredCallCount: number;
    estimatedCallCount: number;
    updatedAt: string;
  }>;
}

export interface RuntimeStateRepository {
  load(): Promise<RuntimeStateSnapshot>;
  save(snapshot: RuntimeStateSnapshot): Promise<void>;
}

export class FileRuntimeStateRepository implements RuntimeStateRepository {
  private readonly filePath: string;

  constructor(filePath = loadSettings().tasksStateFilePath) {
    this.filePath = resolve(filePath);
  }

  async load(): Promise<RuntimeStateSnapshot> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<RuntimeStateSnapshot>;
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        learningJobs: Array.isArray(parsed.learningJobs) ? parsed.learningJobs : [],
        pendingExecutions: Array.isArray(parsed.pendingExecutions) ? parsed.pendingExecutions : [],
        chatSessions: Array.isArray(parsed.chatSessions) ? parsed.chatSessions : [],
        chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
        chatEvents: Array.isArray(parsed.chatEvents) ? parsed.chatEvents : [],
        chatCheckpoints: Array.isArray(parsed.chatCheckpoints) ? parsed.chatCheckpoints : [],
        governance: {
          disabledSkillSourceIds: Array.isArray(parsed.governance?.disabledSkillSourceIds)
            ? parsed.governance?.disabledSkillSourceIds
            : [],
          disabledCompanyWorkerIds: Array.isArray(parsed.governance?.disabledCompanyWorkerIds)
            ? parsed.governance?.disabledCompanyWorkerIds
            : [],
          disabledConnectorIds: Array.isArray(parsed.governance?.disabledConnectorIds)
            ? parsed.governance?.disabledConnectorIds
            : [],
          configuredConnectors: Array.isArray(parsed.governance?.configuredConnectors)
            ? parsed.governance?.configuredConnectors
            : [],
          connectorDiscoveryHistory: Array.isArray(parsed.governance?.connectorDiscoveryHistory)
            ? parsed.governance?.connectorDiscoveryHistory
            : [],
          connectorPolicyOverrides: Array.isArray(parsed.governance?.connectorPolicyOverrides)
            ? parsed.governance?.connectorPolicyOverrides
            : [],
          capabilityPolicyOverrides: Array.isArray(parsed.governance?.capabilityPolicyOverrides)
            ? parsed.governance?.capabilityPolicyOverrides
            : []
        },
        governanceAudit: Array.isArray(parsed.governanceAudit) ? parsed.governanceAudit : [],
        usageHistory: Array.isArray(parsed.usageHistory) ? parsed.usageHistory : [],
        evalHistory: Array.isArray(parsed.evalHistory) ? parsed.evalHistory : [],
        usageAudit: Array.isArray(parsed.usageAudit) ? parsed.usageAudit : []
      };
    } catch {
      return {
        tasks: [],
        learningJobs: [],
        pendingExecutions: [],
        chatSessions: [],
        chatMessages: [],
        chatEvents: [],
        chatCheckpoints: [],
        governance: {
          disabledSkillSourceIds: [],
          disabledCompanyWorkerIds: [],
          disabledConnectorIds: [],
          configuredConnectors: [],
          connectorDiscoveryHistory: [],
          connectorPolicyOverrides: [],
          capabilityPolicyOverrides: []
        },
        governanceAudit: [],
        usageHistory: [],
        evalHistory: [],
        usageAudit: []
      };
    }
  }

  async save(snapshot: RuntimeStateSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  }
}
