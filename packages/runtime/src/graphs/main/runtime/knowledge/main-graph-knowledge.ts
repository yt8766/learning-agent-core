import type { EvaluationResult, EvidenceRecord, ReviewRecord } from '@agent/core';
import type { RuntimeTaskRecord } from '../../../../runtime/runtime-task.types';

export function isDiagnosisTask(
  target: Pick<RuntimeTaskRecord, 'goal' | 'context'> | { goal?: string; context?: string }
): boolean {
  const normalizedGoal = String(target.goal ?? '')
    .trim()
    .toLowerCase();
  const normalizedContext = String(target.context ?? '')
    .trim()
    .toLowerCase();
  return (
    normalizedContext.includes('diagnosis_for:') ||
    normalizedGoal.includes('请诊断任务') ||
    normalizedGoal.includes('agent 错误') ||
    normalizedGoal.includes('恢复方案') ||
    normalizedGoal.includes('diagnose task')
  );
}

export function appendDiagnosisEvidence(
  task: RuntimeTaskRecord,
  review: ReviewRecord,
  executionSummary: string,
  finalAnswer: string
) {
  if (!isDiagnosisTask(task)) {
    return;
  }

  const record: EvidenceRecord = {
    id: `${task.id}:diagnosis_result`,
    taskId: task.id,
    sourceType: 'diagnosis_result',
    trustClass: 'internal',
    summary: `已形成 agent 故障诊断结论，评审决策 ${review.decision}。`,
    detail: {
      reviewDecision: review.decision,
      reviewNotes: review.notes,
      executionSummary,
      finalAnswer
    },
    linkedRunId: task.runId,
    createdAt: new Date().toISOString()
  };

  const sources = task.externalSources ?? [];
  if (!sources.some(source => source.sourceType === record.sourceType && source.id === record.id)) {
    task.externalSources = [...sources, record];
  }
}

export function buildFreshnessSourceSummary(task: RuntimeTaskRecord, freshnessSensitive: boolean): string | undefined {
  if (!freshnessSensitive) {
    return undefined;
  }
  const sources = (task.externalSources ?? []).filter(source => source.sourceType !== 'freshness_meta');
  if (!sources.length) {
    return '本轮未记录到可用来源，请在答复中明确说明时效性信息仍需进一步检索确认。';
  }
  const officialCount = sources.filter(source => source.trustClass === 'official').length;
  const curatedCount = sources.filter(source => source.trustClass === 'curated').length;
  const sourceTypes = Array.from(new Set(sources.map(source => source.sourceType))).slice(0, 4);
  return [
    `本轮共参考 ${sources.length} 条来源`,
    `官方来源 ${officialCount} 条`,
    curatedCount > 0 ? `策展来源 ${curatedCount} 条` : '',
    sourceTypes.length ? `来源类型：${sourceTypes.join('、')}` : ''
  ]
    .filter(Boolean)
    .join('；');
}

export function buildCitationSourceSummary(task: RuntimeTaskRecord): string | undefined {
  const sources = (task.externalSources ?? []).filter(source => {
    if (
      source.sourceType === 'freshness_meta' ||
      source.sourceType === 'web_search_result' ||
      source.sourceType === 'web_research_plan'
    ) {
      return false;
    }
    if (source.sourceUrl) {
      return true;
    }
    return source.sourceType === 'document' || source.sourceType === 'web';
  });

  if (!sources.length) {
    return undefined;
  }

  return sources
    .slice(0, 5)
    .map((source, index) => {
      const label = source.sourceType === 'document' ? '文档' : '网页';
      const host = source.sourceUrl ? (safeGetHost(source.sourceUrl) ?? source.sourceUrl) : source.sourceType;
      return `${index + 1}. [${label}|${source.trustClass}] ${source.summary}（${host}）`;
    })
    .join('\n');
}

export function upsertFreshnessEvidence(
  task: RuntimeTaskRecord,
  freshnessSensitive: boolean,
  sourceSummary: string | undefined
): void {
  const sources = (task.externalSources ?? []).filter(source => source.sourceType !== 'freshness_meta');
  if (!freshnessSensitive) {
    task.externalSources = sources;
    return;
  }

  const referenceTime = task.updatedAt ?? task.createdAt ?? new Date().toISOString();
  const referenceDate = referenceTime.slice(0, 10);
  const officialCount = sources.filter(source => source.trustClass === 'official').length;
  const curatedCount = sources.filter(source => source.trustClass === 'curated').length;
  const sourceTypes = Array.from(new Set(sources.map(source => source.sourceType))).slice(0, 6);

  task.externalSources = [
    ...sources,
    {
      id: `${task.id}:freshness_meta`,
      taskId: task.id,
      sourceType: 'freshness_meta',
      trustClass: 'internal',
      summary: [`信息基准日期：${referenceDate}`, sourceSummary].filter(Boolean).join('；'),
      detail: {
        freshnessSensitive: true,
        referenceDate,
        referenceTime,
        sourceCount: sources.length,
        officialCount,
        curatedCount,
        sourceTypes
      },
      linkedRunId: task.runId,
      createdAt: task.createdAt,
      fetchedAt: referenceTime
    }
  ];
}

function safeGetHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

export function normalizeAgentError(error: unknown): {
  code: string;
  category: 'provider' | 'tool' | 'approval' | 'state' | 'runtime';
  name: string;
  message: string;
  retryable: boolean;
  stack?: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();
  const name = error instanceof Error ? error.name : 'UnknownError';
  if (
    lowered.includes('timeout') ||
    lowered.includes('rate limit') ||
    lowered.includes('429') ||
    lowered.includes('502') ||
    lowered.includes('503') ||
    lowered.includes('504')
  ) {
    return {
      code: 'provider_transient_error',
      category: 'provider',
      name,
      message,
      retryable: true,
      stack: error instanceof Error ? error.stack : undefined
    };
  }
  if (lowered.includes('approval')) {
    return {
      code: 'approval_flow_error',
      category: 'approval',
      name,
      message,
      retryable: false,
      stack: error instanceof Error ? error.stack : undefined
    };
  }
  if (
    lowered.includes('tool') ||
    lowered.includes('connector') ||
    lowered.includes('capability') ||
    lowered.includes('sandbox')
  ) {
    return {
      code: 'tool_execution_error',
      category: 'tool',
      name,
      message,
      retryable: lowered.includes('timeout') || lowered.includes('temporar'),
      stack: error instanceof Error ? error.stack : undefined
    };
  }
  if (lowered.includes('state') || lowered.includes('undefined') || lowered.includes('null')) {
    return {
      code: 'state_transition_error',
      category: 'state',
      name,
      message,
      retryable: false,
      stack: error instanceof Error ? error.stack : undefined
    };
  }
  return {
    code: 'agent_runtime_error',
    category: 'runtime',
    name,
    message,
    retryable: false,
    stack: error instanceof Error ? error.stack : undefined
  };
}

export function inferAgentRoleFromMinistry(ministry?: string) {
  if (ministry === 'hubu-search' || ministry === 'libu-delivery' || ministry === 'libu-docs') {
    return 'research' as const;
  }
  if (ministry === 'xingbu-review') {
    return 'reviewer' as const;
  }
  return 'executor' as const;
}

export function recordAgentError(
  task: RuntimeTaskRecord,
  error: unknown,
  context: {
    phase: 'task_pipeline' | 'approval_recovery' | 'background_runner';
    mode?: 'initial' | 'retry' | 'approval_resume';
    goal?: string;
    routeFlow?: string;
    toolName?: string;
    intent?: string;
  },
  callbacks: {
    getMinistryLabel: (ministry: string) => string;
    addTrace: (task: RuntimeTaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
    addProgressDelta: (task: RuntimeTaskRecord, content: string) => void;
    upsertAgentState: (task: RuntimeTaskRecord, state: Record<string, unknown>) => void;
  }
): void {
  const normalized = normalizeAgentError(error);
  const summary = [
    `${callbacks.getMinistryLabel(task.currentMinistry ?? 'gongbu-code')}执行失败`,
    normalized.message,
    normalized.retryable ? '可考虑重试或转刑部诊断。' : '建议先检查节点契约、connector 或 provider 配置。'
  ].join(' ');

  callbacks.addTrace(task, 'agent_error', summary, {
    phase: context.phase,
    mode: context.mode,
    goal: context.goal ?? task.goal,
    routeFlow: context.routeFlow,
    node: task.currentNode,
    step: task.currentStep,
    ministry: task.currentMinistry,
    worker: task.currentWorker,
    toolName: context.toolName,
    intent: context.intent,
    errorCode: normalized.code,
    errorCategory: normalized.category,
    errorName: normalized.name,
    errorMessage: normalized.message,
    retryable: normalized.retryable,
    stack: normalized.stack
  });
  callbacks.addProgressDelta(task, `执行遇到异常：${normalized.message}`);
  callbacks.upsertAgentState(task, {
    agentId: task.currentWorker ?? task.currentMinistry ?? 'agent-error-boundary',
    role: inferAgentRoleFromMinistry(task.currentMinistry),
    goal: task.goal,
    plan: [],
    toolCalls: [],
    observations: [`agent_error:${normalized.code}`, normalized.message],
    shortTermMemory: [],
    longTermMemoryRefs: [],
    status: 'failed',
    finalOutput: normalized.message
  });
}
