import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import {
  ActionIntent,
  ChatCheckpointRecord,
  ChatEventRecord,
  ChatMessageRecord,
  ChatSessionRecord,
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
  private readonly filePath = resolve(loadSettings().tasksStateFilePath);

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
