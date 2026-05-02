import type { TaskBundle } from '@/types/admin';
import type { TaskRecord, TraceRecord } from '@/types/admin/tasking';

export function formatRouteConfidence(confidence?: number) {
  if (typeof confidence !== 'number') {
    return null;
  }
  if (confidence >= 0.8) {
    return `置信 ${Math.round(confidence * 100)}% / high`;
  }
  if (confidence >= 0.5) {
    return `置信 ${Math.round(confidence * 100)}% / medium`;
  }
  return `置信 ${Math.round(confidence * 100)}% / fallback`;
}

export function buildRouteReason(task?: TaskRecord | null) {
  if (!task?.specialistLead) {
    return null;
  }
  if (task.specialistLead.domain === 'general-assistant') {
    return task.specialistLead.reason ? `通用助理兜底：${task.specialistLead.reason}` : '通用助理兜底';
  }
  return task.specialistLead.reason ?? null;
}

export function getExecutionStepOwnerLabel(owner?: string) {
  switch (owner) {
    case 'session':
      return '会话层';
    case 'libu':
      return '吏部';
    case 'hubu':
      return '户部';
    case 'gongbu':
      return '工部';
    case 'bingbu':
      return '兵部';
    case 'xingbu':
      return '刑部';
    case 'libu-docs':
      return '礼部';
    case 'system':
      return '系统';
    default:
      return owner ?? '--';
  }
}

export function summarizeExecutionSteps(task?: TaskRecord | null) {
  if (!task?.executionSteps?.length) {
    return null;
  }
  const blockedCount = task.executionSteps.filter(step => step.status === 'blocked').length;
  const recoveryCount = task.executionSteps.filter(step => step.stage === 'recovery').length;
  const current = task.currentExecutionStep;
  const currentCopy = current ? `${current.label} / ${getExecutionStepOwnerLabel(current.owner)}` : '未进入阶段';
  const lastReason = [...task.executionSteps].reverse().find(step => step.reason)?.reason;
  return {
    currentCopy,
    blockedCount,
    recoveryCount,
    lastReason: current?.reason ?? lastReason
  };
}

export function getTraceNodeLabel(node: string) {
  switch (node) {
    case 'planning_readonly_guard':
      return '计划只读保护';
    default:
      return node;
  }
}

export function getTraceSummaryCopy(trace: Pick<TraceRecord, 'node' | 'summary'>) {
  if (trace.node === 'planning_readonly_guard') {
    return '计划只读保护已启用，当前主动跳过 open-web、浏览器、终端与写入路径。';
  }
  return trace.summary;
}

export function getAuditEntryTitle(entry: { type: string; title: string; summary: string }) {
  if (entry.title === 'planning_readonly_guard') {
    return `${entry.type} / 计划只读保护`;
  }
  return `${entry.type} / ${entry.title}`;
}

export function getAuditEntrySummary(entry: { title: string; summary: string }) {
  if (entry.title === 'planning_readonly_guard') {
    return '计划只读保护已启用，当前主动跳过 open-web、浏览器、终端与写入路径。';
  }
  return entry.summary;
}

export function renderFindingMeta(label: string, values?: string[]) {
  if (!values?.length) {
    return null;
  }

  return `${label}: ${values.join('；')}`;
}

export function buildTraceView(traces: TraceRecord[]) {
  const depthBySpan = new Map<string, number>();
  const nodeBySpan = new Map<string, string>();
  return traces.map(trace => {
    const depth = trace.parentSpanId ? (depthBySpan.get(trace.parentSpanId) ?? 0) + 1 : 0;
    if (trace.spanId) {
      depthBySpan.set(trace.spanId, depth);
      nodeBySpan.set(trace.spanId, trace.node);
    }
    return {
      ...trace,
      depth,
      parentNode: trace.parentSpanId ? nodeBySpan.get(trace.parentSpanId) : undefined
    };
  });
}

export function buildTraceWaterfallRows(traces: TraceRecord[]) {
  const traceView = buildTraceView(traces);
  if (!traceView.length) {
    return [];
  }

  const timestamps = traceView
    .map(trace => Date.parse(trace.at))
    .filter(timestamp => Number.isFinite(timestamp))
    .sort((left, right) => left - right);
  const baseTimestamp = timestamps[0] ?? Date.now();
  const maxOffset = Math.max(
    1,
    ...traceView.map(trace => {
      const parsed = Date.parse(trace.at);
      return Number.isFinite(parsed) ? parsed - baseTimestamp : 0;
    })
  );
  const maxLatency = Math.max(
    1,
    ...traceView.map(trace => (typeof trace.latencyMs === 'number' ? trace.latencyMs : 0))
  );

  return traceView.map(trace => {
    const parsed = Date.parse(trace.at);
    const offset = Number.isFinite(parsed) ? parsed - baseTimestamp : 0;
    const widthPercent = typeof trace.latencyMs === 'number' ? Math.max(12, (trace.latencyMs / maxLatency) * 88) : 16;
    const offsetPercent = maxOffset > 0 ? Math.min(76, (offset / maxOffset) * 76) : 0;
    const chainLabel = trace.depth > 0 ? `depth ${trace.depth}` : 'root';
    return {
      ...trace,
      chainLabel,
      offsetPercent,
      widthPercent
    };
  });
}

export function buildCriticalPathSummary(traces: TraceRecord[]) {
  const traceView = buildTraceView(traces);
  if (!traceView.length) {
    return null;
  }

  const childrenByParent = new Map<string | undefined, typeof traceView>();
  for (const trace of traceView) {
    const parent = trace.parentSpanId;
    const current = childrenByParent.get(parent) ?? [];
    current.push(trace);
    childrenByParent.set(parent, current);
  }

  let bestPath: typeof traceView = [];
  let bestLatency = -1;

  function walk(trace: (typeof traceView)[number], chain: typeof traceView, totalLatency: number) {
    const nextChain = [...chain, trace];
    const nextLatency = totalLatency + (trace.latencyMs ?? 0);
    const children = childrenByParent.get(trace.spanId);
    if (!children?.length) {
      if (nextLatency > bestLatency) {
        bestLatency = nextLatency;
        bestPath = nextChain;
      }
      return;
    }
    for (const child of children) {
      walk(child, nextChain, nextLatency);
    }
  }

  for (const root of childrenByParent.get(undefined) ?? []) {
    walk(root, [], 0);
  }

  if (!bestPath.length) {
    return null;
  }

  const slowest = [...bestPath].sort((left, right) => (right.latencyMs ?? 0) - (left.latencyMs ?? 0))[0];
  return {
    pathLabel: bestPath.map(item => item.node).join(' -> '),
    totalLatencyMs: Math.max(0, bestLatency),
    slowestNode: slowest?.node,
    fallbackNodes: bestPath.filter(item => item.isFallback).map(item => item.node)
  };
}

export function resolveCriticalPathSummary(bundle: TaskBundle | null) {
  const backendSummary = bundle?.audit?.traceSummary;
  if (backendSummary?.criticalPaths?.length) {
    const primary = backendSummary.criticalPaths[0];
    if (!primary) {
      return bundle ? buildCriticalPathSummary(bundle.traces) : null;
    }
    return {
      pathLabel: primary.pathLabel,
      totalLatencyMs: primary.totalLatencyMs,
      slowestNode: backendSummary.slowestSpan?.node,
      fallbackNodes: primary.fallbackNodes
    };
  }

  return bundle ? buildCriticalPathSummary(bundle.traces) : null;
}
