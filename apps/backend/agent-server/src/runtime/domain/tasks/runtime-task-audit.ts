import type { RuntimeStateSnapshot } from '@agent/memory';
import type { ManagerPlan, TaskRecord } from '@agent/core';
import { buildTraceAnalytics } from '@agent/runtime';

import { extractBrowserReplay } from '../../helpers/runtime-connector-utils';

type GovernanceAuditEntry = NonNullable<RuntimeStateSnapshot['governanceAudit']>[number];
type UsageAuditEntry = NonNullable<RuntimeStateSnapshot['usageAudit']>[number];

export type TaskAuditEntry =
  | {
      id: string;
      at: string;
      type: 'governance';
      title: string;
      summary: string;
      detail?: string;
      outcome: GovernanceAuditEntry['outcome'];
    }
  | {
      id: string;
      at: string;
      type: 'trace';
      title?: string;
      summary?: string;
      detail?: Record<string, unknown>;
    }
  | {
      id: string;
      at: string;
      type: 'approval';
      title?: string;
      summary?: string;
      detail?: string;
    }
  | {
      id: string;
      at: string;
      type: 'usage';
      title: 'usage-audit';
      summary: string;
      detail: UsageAuditEntry['modelBreakdown'];
    };

export function buildTaskAudit(taskId: string, task: TaskRecord, snapshot: RuntimeStateSnapshot) {
  const relatedGovernanceTargets = new Set<string>([
    ...(task.connectorRefs ?? []),
    ...(task.usedInstalledSkills ?? []),
    ...(task.usedCompanyWorkers ?? []),
    task.currentWorker ?? ''
  ]);
  const governanceEntries = (snapshot.governanceAudit ?? [])
    .filter(entry => relatedGovernanceTargets.has(entry.targetId))
    .map(
      (entry): TaskAuditEntry => ({
        id: entry.id,
        at: entry.at,
        type: 'governance',
        title: entry.action,
        summary: `${entry.scope}:${entry.targetId}`,
        detail: entry.reason,
        outcome: entry.outcome
      })
    );
  const traceEntries = (task.trace ?? []).map(
    (trace, index): TaskAuditEntry => ({
      id: `${task.id}:trace:${index}`,
      at: trace.at,
      type: 'trace',
      title: trace.node,
      summary: trace.summary,
      detail: trace.data
    })
  );
  const approvalEntries = (task.approvals ?? []).map(
    (approval, index): TaskAuditEntry => ({
      id: `${task.id}:approval:${index}`,
      at: task.updatedAt,
      type: 'approval',
      title: approval.intent,
      summary: approval.decision,
      detail: approval.reason
    })
  );
  const usageEntry = (snapshot.usageAudit ?? []).find(entry => entry.taskId === taskId);
  const usageAuditEntries: TaskAuditEntry[] = usageEntry
    ? [
        {
          id: `${task.id}:usage`,
          at: usageEntry.updatedAt,
          type: 'usage',
          title: 'usage-audit',
          summary: `${usageEntry.totalTokens} tokens / $${usageEntry.totalCostUsd.toFixed(4)}`,
          detail: usageEntry.modelBreakdown
        }
      ]
    : [];
  const browserReplays = (task.trace ?? [])
    .map(trace => extractBrowserReplay(trace.data))
    .filter(Boolean)
    .map(replay => ({
      sessionId: replay.sessionId,
      url: replay.url,
      artifactRef: replay.artifactRef,
      snapshotRef: replay.snapshotRef,
      screenshotRef: replay.screenshotRef,
      stepCount: replay.steps?.length ?? replay.stepTrace?.length ?? 0
    }));

  return {
    taskId,
    entries: [...traceEntries, ...approvalEntries, ...governanceEntries, ...usageAuditEntries].sort((left, right) =>
      right.at.localeCompare(left.at)
    ),
    browserReplays,
    traceSummary: buildTraceAnalytics(task.trace ?? [])
  };
}

export function buildFallbackTaskPlan(task: TaskRecord): ManagerPlan {
  const traceSteps = (task.trace ?? [])
    .map(trace => trace?.summary?.trim())
    .filter(Boolean)
    .slice(0, 4);
  const routeSummary =
    task.chatRoute?.flow === 'direct-reply'
      ? '本轮命中 direct-reply 路线，由首辅直接结合会话上下文完成回答。'
      : task.currentStep
        ? `本轮当前处于 ${task.currentStep} 阶段。`
        : '本轮未生成显式结构化计划，当前展示执行回放摘要。';
  const steps = traceSteps.length ? traceSteps : [routeSummary];

  return {
    id: `fallback-plan:${task.id}`,
    goal: task.goal,
    summary: routeSummary,
    steps,
    createdAt: task.createdAt,
    subTasks: [
      {
        id: `${task.id}:fallback-subtask`,
        title: task.chatRoute?.flow === 'direct-reply' ? '会话直答' : '执行摘要',
        description: routeSummary,
        assignedTo: mapTaskAssignedRole(task),
        status: mapTaskPlanStatus(task.status)
      }
    ]
  };
}

function mapTaskAssignedRole(task: TaskRecord): ManagerPlan['subTasks'][number]['assignedTo'] {
  const currentMinistry = task.currentMinistry?.toLowerCase();
  const latestDispatch = [...(task.dispatches ?? [])].reverse().find(dispatch => dispatch.kind !== 'fallback');

  if (
    latestDispatch?.specialistDomain === 'risk-compliance' ||
    latestDispatch?.requiredCapabilities?.includes('specialist.risk-compliance') ||
    latestDispatch?.selectedAgentId?.includes('reviewer') ||
    latestDispatch?.agentId?.includes('reviewer')
  ) {
    return 'reviewer';
  }

  if (latestDispatch?.kind === 'strategy') {
    return 'research';
  }

  if (latestDispatch?.kind === 'ministry') {
    return 'executor';
  }

  switch (currentMinistry) {
    case 'research':
    case 'hubu-search':
    case 'libu-delivery':
    case 'libu-docs':
      return 'research';
    case 'review':
    case 'xingbu-review':
      return 'reviewer';
    case 'execution':
    case 'gongbu-code':
    case 'bingbu-ops':
      return 'executor';
    default:
      return 'manager';
  }
}

function mapTaskPlanStatus(status?: string): ManagerPlan['subTasks'][number]['status'] {
  switch (status) {
    case 'queued':
    case 'waiting_approval':
      return 'pending';
    case 'running':
      return 'running';
    case 'blocked':
      return 'blocked';
    default:
      return 'completed';
  }
}
