import { ActionIntent, TaskStatus } from '@agent/core';
import type { RuntimeTaskRecord } from '../../../runtime/runtime-task.types';

import { appendDiagnosisEvidence, upsertFreshnessEvidence } from '../knowledge/main-graph-knowledge';
import { hydrateLifecycleSnapshot, persistLifecycleSnapshot } from './main-graph-lifecycle-state';

export function enforceInterruptControllerPolicy(params: {
  task: RuntimeTaskRecord;
  addTrace: (trace: RuntimeTaskRecord['trace'], node: string, summary: string, data?: Record<string, unknown>) => void;
}): void {
  const interrupt = params.task.activeInterrupt;
  if (!interrupt) {
    return;
  }

  if (interrupt.origin) {
    params.task.interruptOrigin = interrupt.origin;
  }

  const payload = interrupt.payload;
  const questionPayload =
    payload && typeof payload === 'object' && Array.isArray((payload as { questions?: unknown[] }).questions)
      ? ((payload as { questions: Array<Record<string, unknown>> }).questions ?? [])
      : undefined;

  if (interrupt.kind === 'user-input' && interrupt.proxySourceAgentId && interrupt.origin !== 'counselor_proxy') {
    interrupt.status = 'cancelled';
    interrupt.resolvedAt = new Date().toISOString();
    params.task.interruptHistory = [...(params.task.interruptHistory ?? []), { ...interrupt }];
    params.addTrace(params.task.trace, 'interrupt_proxy_violation', '属官越权试图直接创建用户中断，司礼监已拒绝。', {
      proxySourceAgentId: interrupt.proxySourceAgentId,
      origin: interrupt.origin
    });
    params.task.activeInterrupt = undefined;
    return;
  }

  if (interrupt.origin === 'counselor_proxy' && questionPayload && questionPayload.length > 3) {
    const truncatedQuestions = questionPayload.slice(0, 3);
    interrupt.payload = {
      ...(typeof payload === 'object' && payload ? payload : {}),
      questions: truncatedQuestions
    };
    params.addTrace(params.task.trace, 'interrupt_controller', '群辅已将属官提问压缩为最多 3 个高层问题。', {
      interactionKind: interrupt.interactionKind,
      originalQuestionCount: questionPayload.length,
      compressedQuestionCount: truncatedQuestions.length
    });
  }
}

export function finalizeLifecycleTaskState(task: RuntimeTaskRecord): void {
  if (task.partialAggregation) {
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.FAILED ||
      task.status === TaskStatus.CANCELLED
    ) {
      task.partialAggregation = undefined;
      task.internalSubAgents = undefined;
    }
  }

  if (task.review && task.result) {
    appendDiagnosisEvidence(task, task.review, task.result, task.result);
  }
}

export function upsertLifecycleFreshnessEvidence(
  task: RuntimeTaskRecord,
  isFreshnessSensitiveGoal: (goal: string) => boolean,
  freshnessSummary: string | undefined
): void {
  upsertFreshnessEvidence(task, isFreshnessSensitiveGoal(task.goal), freshnessSummary);
}

export function buildSkillInstallPendingExecution(task: RuntimeTaskRecord, normalizedGoal: string) {
  if (task.pendingApproval?.intent !== ActionIntent.INSTALL_SKILL) {
    return undefined;
  }

  const approvalTrace = task.trace
    .slice()
    .reverse()
    .find(item => item.node === 'approval_gate');

  return {
    taskId: task.id,
    intent: ActionIntent.INSTALL_SKILL,
    toolName: task.pendingApproval.toolName,
    researchSummary: task.goal,
    kind: 'skill_install' as const,
    receiptId: approvalTrace?.data?.receiptId as string | undefined,
    goal: normalizedGoal,
    usedInstalledSkills: task.usedInstalledSkills,
    currentSkillExecution: task.currentSkillExecution,
    skillDisplayName: approvalTrace?.data?.skillDisplayName as string | undefined
  };
}

export async function persistLifecycleState(params: {
  runtimeStateRepository: Parameters<typeof persistLifecycleSnapshot>[0]['runtimeStateRepository'];
  tasks: Parameters<typeof persistLifecycleSnapshot>[0]['tasks'];
  learningJobs: Parameters<typeof persistLifecycleSnapshot>[0]['learningJobs'];
  learningQueue: Parameters<typeof persistLifecycleSnapshot>[0]['learningQueue'];
  pendingExecutions: Parameters<typeof persistLifecycleSnapshot>[0]['pendingExecutions'];
}) {
  await persistLifecycleSnapshot(params);
}

export async function hydrateLifecycleState(params: {
  runtimeStateRepository: Parameters<typeof hydrateLifecycleSnapshot>[0]['runtimeStateRepository'];
  tasks: Parameters<typeof hydrateLifecycleSnapshot>[0]['tasks'];
  learningJobs: Parameters<typeof hydrateLifecycleSnapshot>[0]['learningJobs'];
  learningQueue: Parameters<typeof hydrateLifecycleSnapshot>[0]['learningQueue'];
  pendingExecutions: Parameters<typeof hydrateLifecycleSnapshot>[0]['pendingExecutions'];
}) {
  await hydrateLifecycleSnapshot(params);
}
