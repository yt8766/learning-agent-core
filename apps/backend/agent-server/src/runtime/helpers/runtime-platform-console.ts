import { ChatCheckpointRecord, ChatSessionRecord, getMinistryDisplayName, normalizeExecutionMode } from '@agent/shared';

export interface RuntimePlatformConsoleContext {
  skillRegistry: {
    list: () => Promise<unknown[]>;
  };
  orchestrator: {
    listRules: () => Promise<unknown[]>;
    listTasks: () => unknown[];
  };
  sessionCoordinator: {
    listSessions: () => ChatSessionRecord[];
    getCheckpoint: (sessionId: string) => ChatCheckpointRecord | undefined;
  };
  getRuntimeCenter: (days?: number, filters?: Record<string, unknown>) => Promise<any>;
  getApprovalsCenter: (filters?: Record<string, unknown>) => unknown;
  getLearningCenter: () => Promise<unknown>;
  getEvalsCenter: (days?: number, filters?: Record<string, unknown>) => Promise<any>;
  getEvidenceCenter: () => Promise<unknown>;
  getConnectorsCenter: () => Promise<unknown[]>;
  getSkillSourcesCenter: () => Promise<unknown>;
  getCompanyAgentsCenter: () => unknown;
}

export async function buildPlatformConsole(
  context: RuntimePlatformConsoleContext,
  days = 30,
  filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    runtimeExecutionMode?: string;
    runtimeInteractionKind?: string;
    approvalsExecutionMode?: string;
    approvalsInteractionKind?: string;
  }
) {
  const [skills, rules, learning, skillSources, connectors, companyAgents] = await Promise.all([
    context.skillRegistry.list().catch(() => []),
    context.orchestrator.listRules().catch(() => []),
    context.getLearningCenter().catch(() => ({
      totalCandidates: 0,
      pendingCandidates: 0,
      confirmedCandidates: 0,
      candidates: []
    })),
    context.getSkillSourcesCenter().catch(() => ({
      sources: [],
      manifests: [],
      installed: [],
      receipts: []
    })),
    context.getConnectorsCenter().catch(() => []),
    Promise.resolve()
      .then(() => context.getCompanyAgentsCenter())
      .catch(() => [])
  ]);
  const tasks = context.orchestrator.listTasks();
  const sessions = context.sessionCoordinator.listSessions();
  const checkpoints = sessions
    .map(session => {
      const checkpoint = context.sessionCoordinator.getCheckpoint(session.id);
      return checkpoint ? { session, checkpoint } : undefined;
    })
    .filter((item): item is { session: ChatSessionRecord; checkpoint: ChatCheckpointRecord } => Boolean(item));

  return {
    runtime: await context.getRuntimeCenter(days, {
      status: filters?.status,
      model: filters?.model,
      pricingSource: filters?.pricingSource,
      executionMode: filters?.runtimeExecutionMode,
      interactionKind: filters?.runtimeInteractionKind
    }),
    approvals: context.getApprovalsCenter({
      executionMode: filters?.approvalsExecutionMode,
      interactionKind: filters?.approvalsInteractionKind
    }),
    learning,
    evals: await context.getEvalsCenter(days),
    skills,
    evidence: await context.getEvidenceCenter(),
    connectors,
    skillSources,
    companyAgents,
    rules,
    tasks,
    sessions,
    checkpoints
  };
}

export async function exportRuntimeCenter(
  context: Pick<RuntimePlatformConsoleContext, 'getRuntimeCenter'>,
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
  const runtime = await context.getRuntimeCenter(options?.days ?? 30, options);
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
    ...(runtime.usageAnalytics.persistedDailyHistory ?? runtime.usageAnalytics.daily).map(
      point =>
        `${point.day},${point.tokens},${point.costUsd},${point.costCny},${point.runs},${point.overBudget ? 'true' : 'false'}`
    ),
    '',
    `filters,${csv(options?.status ?? '')},${csv(options?.model ?? '')},${csv(options?.pricingSource ?? '')},${csv(normalizeExecutionMode(options?.executionMode) ?? options?.executionMode ?? '')},${csv(options?.interactionKind ?? '')}`,
    'filterStatus,filterModel,filterPricingSource,filterExecutionMode,filterInteractionKind',
    '',
    'taskId,status,executionMode,currentMinistry,requestedBy,interruptSource,interactionKind,currentWorker,updatedAt',
    ...runtime.recentRuns.map(
      task =>
        `${csv(task.id)},${csv(task.status)},${csv(normalizeExecutionMode(task.executionMode) ?? task.executionMode ?? '')},${csv(getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry ?? '')},${csv(getMinistryDisplayName(task.pendingApproval?.requestedBy ?? task.activeInterrupt?.requestedBy) ?? task.pendingApproval?.requestedBy ?? task.activeInterrupt?.requestedBy ?? '')},${csv(task.activeInterrupt?.source ?? '')},${csv(resolveInteractionKind(task))},${csv(task.currentWorker)},${csv(task.updatedAt)}`
    )
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
  const approvals = context.getApprovalsCenter(options) as any[];
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
    'taskId,status,executionMode,currentMinistry,requestedBy,interruptSource,interactionKind,currentWorker,intent,toolName,riskLevel,reason',
    ...approvals.map(
      item =>
        `${csv(item.taskId)},${csv(item.status)},${csv(normalizeExecutionMode(item.executionMode) ?? item.executionMode ?? '')},${csv(getMinistryDisplayName(item.currentMinistry) ?? item.currentMinistry ?? '')},${csv(getMinistryDisplayName(item.pendingApproval?.requestedBy ?? item.activeInterrupt?.requestedBy) ?? item.pendingApproval?.requestedBy ?? item.activeInterrupt?.requestedBy ?? '')},${csv(item.activeInterrupt?.source ?? '')},${csv(resolveInteractionKind(item))},${csv(item.currentWorker)},${csv(item.pendingApproval?.intent ?? item.activeInterrupt?.intent ?? '')},${csv(item.pendingApproval?.toolName ?? item.activeInterrupt?.toolName ?? '')},${csv(item.pendingApproval?.riskLevel ?? item.activeInterrupt?.riskLevel ?? '')},${csv(item.pendingApproval?.reason ?? item.activeInterrupt?.reason ?? '')}`
    )
  ];

  return {
    filename: 'approvals-center.csv',
    mimeType: 'text/csv',
    content: lines.join('\n')
  };
}

function resolveInteractionKind(task: any) {
  // activeInterrupt is the persisted 司礼监 / InterruptController projection for export compatibility.
  if (typeof task.activeInterrupt?.interactionKind === 'string') {
    return task.activeInterrupt.interactionKind;
  }
  const payload = task.activeInterrupt?.payload;
  if (payload && typeof payload === 'object' && typeof payload.interactionKind === 'string') {
    return payload.interactionKind;
  }
  if (task.activeInterrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  return task.pendingApproval || task.activeInterrupt ? 'approval' : '';
}

export async function exportEvalsCenter(
  context: Pick<RuntimePlatformConsoleContext, 'getEvalsCenter'>,
  options?: { days?: number; scenarioId?: string; outcome?: string; format?: string }
) {
  const evals = await context.getEvalsCenter(options?.days ?? 30, options);
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
    ...(evals.persistedDailyHistory ?? evals.dailyTrend).map(
      point => `${point.day},${point.runCount},${point.passCount},${point.passRate}`
    ),
    '',
    'taskId,createdAt,success,scenarioIds',
    ...evals.recentRuns.map(
      run =>
        `${csv(run.taskId)},${csv(run.createdAt)},${run.success ? 'pass' : 'fail'},${csv(run.scenarioIds.join('|'))}`
    ),
    '',
    'promptSuiteId,promptSuiteLabel,promptCount,versions',
    ...((evals.promptRegression?.suites ?? []).map(
      suite => `${csv(suite.suiteId)},${csv(suite.label)},${suite.promptCount},${csv(suite.versions.join('|'))}`
    ) as string[])
  ];

  return {
    filename: `evals-center-${options?.days ?? 30}d.csv`,
    mimeType: 'text/csv',
    content: lines.join('\n')
  };
}

function csv(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.split('"').join('""')}"`;
}
