import { getMinistryDisplayName, normalizeExecutionMode } from './runtime-architecture-helpers';
import type {
  PlatformConsoleRecord,
  PlatformConsoleRuntimeTaskRecord,
  RuntimePlatformConsoleContext
} from '../centers/runtime-platform-console.records';
import {
  normalizePlatformConsoleEvalsRecord,
  normalizePlatformConsoleRuntimeRecord
} from './runtime-platform-console.normalize';
import {
  resolveInterruptPayloadField,
  resolveTaskInteractionKind
} from '../domain/observability/runtime-observability-filters';

export async function exportRuntimeCenter(
  context: {
    getRuntimeCenter: (days?: number, filters?: Record<string, unknown>) => Promise<PlatformConsoleRecord['runtime']>;
  },
  options?: {
    days?: number;
    status?: string;
    model?: string;
    pricingSource?: string;
    executionMode?: string;
    interactionKind?: string;
    format?: string;
  }
) {
  const runtime = normalizePlatformConsoleRuntimeRecord(await context.getRuntimeCenter(options?.days ?? 30, options));
  const usageAnalytics = runtime.usageAnalytics ?? {};
  const persistedDailyHistory = usageAnalytics.persistedDailyHistory ?? usageAnalytics.daily ?? [];
  const recentRuns = runtime.recentRuns ?? [];
  const format = options?.format === 'json' ? 'json' : 'csv';
  if (format === 'json') {
    return {
      filename: `runtime-center-${options?.days ?? 30}d.json`,
      mimeType: 'application/json',
      content: JSON.stringify(runtime, null, 2)
    };
  }

  const lines = [
    'day,tokens,costUsd,costCny,runs,overBudget',
    ...persistedDailyHistory.map(
      point =>
        `${point.day},${point.tokens},${point.costUsd},${point.costCny},${point.runs},${point.overBudget ? 'true' : 'false'}`
    ),
    '',
    `filters,${csv(options?.status ?? '')},${csv(options?.model ?? '')},${csv(options?.pricingSource ?? '')},${csv(normalizeExecutionMode(options?.executionMode) ?? options?.executionMode ?? '')},${csv(options?.interactionKind ?? '')}`,
    'filterStatus,filterModel,filterPricingSource,filterExecutionMode,filterInteractionKind',
    '',
    'taskId,status,executionMode,currentMinistry,requestedBy,interruptSource,interactionKind,currentWorker,selectedAgents,selectionSources,streamNode,streamDetail,streamProgressPercent,compressionApplied,compressionSource,compressedMessageCount,updatedAt',
    ...recentRuns.map(task => {
      const dispatchSelection = summarizeDispatchSelection(task);
      return `${csv(task.id)},${csv(task.status)},${csv(normalizeExecutionMode(task.executionMode) ?? task.executionMode ?? '')},${csv(getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry ?? '')},${csv(getMinistryDisplayName(task.pendingApproval?.requestedBy ?? task.activeInterrupt?.requestedBy) ?? task.pendingApproval?.requestedBy ?? task.activeInterrupt?.requestedBy ?? '')},${csv(task.activeInterrupt?.source ?? '')},${csv(resolveTaskInteractionKind(task) ?? '')},${csv(task.currentWorker)},${csv(dispatchSelection.selectedAgents)},${csv(dispatchSelection.selectionSources)},${csv(task.streamStatus?.nodeLabel ?? task.streamStatus?.nodeId ?? '')},${csv(task.streamStatus?.detail ?? '')},${csv(task.streamStatus?.progressPercent ?? '')},${csv(task.contextFilterState?.filteredContextSlice?.compressionApplied ?? '')},${csv(task.contextFilterState?.filteredContextSlice?.compressionSource ?? '')},${csv(task.contextFilterState?.filteredContextSlice?.compressedMessageCount ?? '')},${csv(task.updatedAt)}`;
    })
  ];

  return {
    filename: `runtime-center-${options?.days ?? 30}d.csv`,
    mimeType: 'text/csv',
    content: lines.join('\n')
  };
}

export async function exportApprovalsCenter(
  context: Pick<RuntimePlatformConsoleContext, 'getApprovalsCenter'>,
  options?: {
    executionMode?: string;
    interactionKind?: string;
    format?: string;
  }
) {
  const approvals = context.getApprovalsCenter(options);
  const format = options?.format === 'json' ? 'json' : 'csv';
  if (format === 'json') {
    return {
      filename: 'approvals-center.json',
      mimeType: 'application/json',
      content: JSON.stringify(approvals, null, 2)
    };
  }

  const lines = [
    `filters,${csv(normalizeExecutionMode(options?.executionMode) ?? options?.executionMode ?? '')},${csv(options?.interactionKind ?? '')}`,
    'filterExecutionMode,filterInteractionKind',
    '',
    'taskId,status,executionMode,currentMinistry,requestedBy,interruptSource,interactionKind,currentWorker,selectedAgents,selectionSources,intent,toolName,riskLevel,reason,commandPreview,riskReason,riskCode,approvalScope,policyMatchStatus,policyMatchSource,lastStreamStatusAt',
    ...approvals.map(item => {
      const dispatchSelection = summarizeDispatchSelection(item);
      return `${csv(item.taskId)},${csv(item.status)},${csv(normalizeExecutionMode(item.executionMode) ?? item.executionMode ?? '')},${csv(getMinistryDisplayName(item.currentMinistry) ?? item.currentMinistry ?? '')},${csv(getMinistryDisplayName(item.pendingApproval?.requestedBy ?? item.activeInterrupt?.requestedBy) ?? item.pendingApproval?.requestedBy ?? item.activeInterrupt?.requestedBy ?? '')},${csv(item.activeInterrupt?.source ?? '')},${csv(resolveTaskInteractionKind(item) ?? '')},${csv(item.currentWorker)},${csv(dispatchSelection.selectedAgents)},${csv(dispatchSelection.selectionSources)},${csv(item.pendingApproval?.intent ?? item.activeInterrupt?.intent ?? '')},${csv(item.pendingApproval?.toolName ?? item.activeInterrupt?.toolName ?? '')},${csv(item.pendingApproval?.riskLevel ?? item.activeInterrupt?.riskLevel ?? '')},${csv(item.pendingApproval?.reason ?? item.activeInterrupt?.reason ?? '')},${csv(resolveInterruptPayloadField(item.activeInterrupt, 'commandPreview') ?? '')},${csv(resolveInterruptPayloadField(item.activeInterrupt, 'riskReason') ?? '')},${csv(resolveInterruptPayloadField(item.activeInterrupt, 'riskCode') ?? '')},${csv(resolveInterruptPayloadField(item.activeInterrupt, 'approvalScope') ?? '')},${csv(item.policyMatchStatus ?? '')},${csv(item.policyMatchSource ?? '')},${csv(item.lastStreamStatusAt ?? '')}`;
    })
  ];

  return {
    filename: 'approvals-center.csv',
    mimeType: 'text/csv',
    content: lines.join('\n')
  };
}

export async function exportEvalsCenter(
  context: Pick<RuntimePlatformConsoleContext, 'getEvalsCenter'>,
  options?: { days?: number; scenarioId?: string; outcome?: string; format?: string }
) {
  const evals = normalizePlatformConsoleEvalsRecord(await context.getEvalsCenter(options?.days ?? 30, options));
  const persistedDailyHistory = evals.persistedDailyHistory ?? [];
  const dailyTrend = evals.dailyTrend ?? [];
  const recentRuns = evals.recentRuns ?? [];
  const promptSuites = evals.promptRegression?.suites ?? [];
  const format = options?.format === 'json' ? 'json' : 'csv';
  if (format === 'json') {
    return {
      filename: `evals-center-${options?.days ?? 30}d.json`,
      mimeType: 'application/json',
      content: JSON.stringify(evals, null, 2)
    };
  }

  const lines = [
    'day,runCount,passCount,passRate',
    ...((persistedDailyHistory.length > 0 ? persistedDailyHistory : dailyTrend).map(
      point =>
        `${csv((point as Record<string, unknown>).day)},${csv((point as Record<string, unknown>).runCount)},${csv((point as Record<string, unknown>).passCount)},${csv((point as Record<string, unknown>).passRate)}`
    ) as string[]),
    '',
    'taskId,createdAt,success,scenarioIds',
    ...(recentRuns.map(
      run =>
        `${csv(run.taskId)},${csv(run.createdAt)},${run.success ? 'pass' : 'fail'},${csv((run.scenarioIds ?? []).join('|'))}`
    ) as string[]),
    '',
    'promptSuiteId,promptSuiteLabel,promptCount,versions',
    ...(promptSuites.map(
      suite =>
        `${csv(suite.suiteId)},${csv(suite.label)},${csv(suite.promptCount)},${csv((suite.versions ?? []).join('|'))}`
    ) as string[])
  ];

  return {
    filename: `evals-center-${options?.days ?? 30}d.csv`,
    mimeType: 'text/csv',
    content: lines.join('\n')
  };
}

function summarizeDispatchSelection(task: unknown) {
  const dispatches =
    typeof task === 'object' &&
    task !== null &&
    'dispatches' in task &&
    Array.isArray((task as { dispatches?: unknown }).dispatches)
      ? ((
          task as {
            dispatches?: Array<{
              selectedAgentId?: string;
              selectionSource?: string;
            }>;
          }
        ).dispatches ?? [])
      : [];
  const selectedAgents = Array.from(
    new Set(dispatches.map(dispatch => dispatch.selectedAgentId).filter((value): value is string => Boolean(value)))
  );
  const selectionSources = Array.from(
    new Set(dispatches.map(dispatch => dispatch.selectionSource).filter((value): value is string => Boolean(value)))
  );

  return {
    selectedAgents: selectedAgents.join('|'),
    selectionSources: selectionSources.join('|')
  };
}

function csv(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.split('"').join('""')}"`;
}
