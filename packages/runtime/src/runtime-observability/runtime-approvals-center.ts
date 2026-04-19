import type { PlatformApprovalRecord, TaskRecord } from '@agent/core';

import { normalizeExecutionMode } from '../runtime/runtime-architecture-helpers';
import {
  resolveInterruptPayloadField,
  resolveTaskExecutionMode,
  resolveTaskInteractionKind
} from './runtime-observability-filters';

interface PlatformApprovalCenterRecord extends PlatformApprovalRecord {
  streamStatus?: unknown;
  contextFilterState?: unknown;
}

export function buildApprovalsCenterRecords(input: {
  tasks: TaskRecord[];
  getMinistryDisplayName: (ministry?: string) => string | undefined;
  filters?: { executionMode?: string; interactionKind?: string };
}): PlatformApprovalCenterRecord[] {
  return input.tasks
    .filter(
      task =>
        !input.filters?.executionMode ||
        resolveTaskExecutionMode(task) ===
          (normalizeExecutionMode(input.filters.executionMode) ?? input.filters.executionMode)
    )
    .filter(task => !input.filters?.interactionKind || resolveTaskInteractionKind(task) === input.filters.interactionKind)
    .map(task => ({
      taskId: task.id,
      goal: task.goal,
      status: task.status,
      sessionId: task.sessionId,
      currentMinistry: input.getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry,
      currentWorker: task.currentWorker,
      executionMode: toPlatformApprovalExecutionMode(resolveTaskExecutionMode(task)),
      streamStatus: readRecord(task, 'streamStatus'),
      contextFilterState: task.contextFilterState,
      pendingApproval: task.pendingApproval,
      activeInterrupt: task.activeInterrupt,
      entryRouterState: task.entryDecision,
      interruptControllerState: {
        activeInterrupt: task.activeInterrupt,
        interruptHistory: task.interruptHistory ?? []
      },
      planDraft: normalizePlatformApprovalPlanDraft(task.planDraft),
      approvals: task.approvals ?? [],
      lastStreamStatusAt: readStreamStatusUpdatedAt(task)
    }))
    .map(
      (task): PlatformApprovalCenterRecord => ({
        ...task,
        commandPreview: resolveInterruptPayloadField(task.activeInterrupt, 'commandPreview'),
        riskReason: resolveInterruptPayloadField(task.activeInterrupt, 'riskReason'),
        riskCode: resolveInterruptPayloadField(task.activeInterrupt, 'riskCode') || task.pendingApproval?.reasonCode,
        approvalScope: resolveInterruptPayloadField(task.activeInterrupt, 'approvalScope'),
        policyMatchStatus: 'manual-pending',
        policyMatchSource: 'manual'
      })
    );
}

function toPlatformApprovalExecutionMode(value: string | undefined): PlatformApprovalRecord['executionMode'] {
  if (
    value === 'standard' ||
    value === 'planning-readonly' ||
    value === 'plan' ||
    value === 'execute' ||
    value === 'imperial_direct'
  ) {
    return value;
  }
  return undefined;
}

function normalizePlatformApprovalPlanDraft(value: TaskRecord['planDraft']): PlatformApprovalRecord['planDraft'] {
  if (!value) {
    return undefined;
  }

  return {
    summary: value.summary,
    autoResolved: value.autoResolved,
    openQuestions: value.openQuestions,
    assumptions: value.assumptions,
    questionSet: value.questionSet,
    microBudget: value.microBudget
      ? {
          readOnlyToolLimit: value.microBudget.readOnlyToolLimit,
          readOnlyToolsUsed: value.microBudget.readOnlyToolsUsed,
          tokenBudgetUsd: value.microBudget.tokenBudgetUsd,
          budgetTriggered: Boolean(value.microBudget.budgetTriggered)
        }
      : undefined
  };
}

function readStreamStatusUpdatedAt(task: TaskRecord): string | undefined {
  const streamStatus = readRecord(task, 'streamStatus');
  const updatedAt = streamStatus?.updatedAt;
  return typeof updatedAt === 'string' ? updatedAt : undefined;
}

function readRecord(task: TaskRecord, key: string): Record<string, unknown> | undefined {
  const value = (task as unknown as Record<string, unknown>)[key];
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}
