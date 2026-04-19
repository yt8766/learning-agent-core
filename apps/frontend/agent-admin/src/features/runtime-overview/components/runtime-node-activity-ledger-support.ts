import type { RunBundleRecord } from '@agent/core';

import type { AgentGraphOverlayFilter } from './runtime-agent-graph-overlay-support';

export type NodeActivityKind = 'trace' | 'checkpoint' | 'evidence' | 'diagnostic' | 'interrupt';

export interface NodeActivityRow {
  id: string;
  kind: NodeActivityKind;
  node: string;
  stage?: string;
  title: string;
  summary: string;
  at: string;
  status?: string;
  metadata: string[];
  focusTarget?: { kind: 'span' | 'checkpoint' | 'evidence'; id: string };
}

function resolveTraceNodeMap(detail: RunBundleRecord) {
  return new Map(detail.traces.map(trace => [trace.spanId, trace.node]));
}

function resolveNodeFromSpanIds(spanIds: string[] | undefined, traceNodeMap: Map<string, string>) {
  for (const spanId of spanIds ?? []) {
    const node = traceNodeMap.get(spanId);
    if (node) {
      return node;
    }
  }
  return undefined;
}

function filterRowsByGraph(rows: NodeActivityRow[], graphFilter?: AgentGraphOverlayFilter) {
  if (!graphFilter) {
    return rows;
  }

  return rows.filter(row => {
    if (row.kind === 'trace' && row.focusTarget?.kind === 'span') {
      return graphFilter.spanIds.includes(row.focusTarget.id);
    }
    if (row.kind === 'checkpoint' && row.focusTarget?.kind === 'checkpoint') {
      return graphFilter.checkpointIds.includes(row.focusTarget.id);
    }
    if (row.kind === 'evidence' && row.focusTarget?.kind === 'evidence') {
      return graphFilter.evidenceIds.includes(row.focusTarget.id);
    }
    if (row.kind === 'diagnostic') {
      return graphFilter.diagnosticIds.includes(row.id.replace('diagnostic:', ''));
    }
    if (row.kind === 'interrupt') {
      return graphFilter.interruptIds.includes(row.id.replace('interrupt:', ''));
    }
    return graphFilter.stages.includes(row.stage ?? '');
  });
}

export function buildNodeActivityLedger(params: {
  detail: RunBundleRecord;
  graphFilter?: AgentGraphOverlayFilter;
}): NodeActivityRow[] {
  const { detail, graphFilter } = params;
  const traceNodeMap = resolveTraceNodeMap(detail);

  const rows: NodeActivityRow[] = [
    ...detail.traces.map(trace => ({
      id: `span:${trace.spanId}`,
      kind: 'trace' as const,
      node: trace.node,
      stage: trace.stage,
      title: trace.node,
      summary: trace.summary,
      at: trace.startedAt,
      status: trace.status,
      metadata: [
        trace.modelUsed ?? '',
        typeof trace.latencyMs === 'number' ? `${trace.latencyMs}ms` : '',
        trace.ministry ?? '',
        trace.worker ?? ''
      ].filter(Boolean),
      focusTarget: { kind: 'span' as const, id: trace.spanId }
    })),
    ...detail.evidence.map(item => ({
      id: `evidence:${item.id}`,
      kind: 'evidence' as const,
      node: (item.linkedSpanId ? traceNodeMap.get(item.linkedSpanId) : undefined) ?? `stage:${item.stage ?? 'unknown'}`,
      stage: item.stage,
      title: item.sourceType ?? item.title ?? item.id,
      summary: item.summary ?? 'evidence captured',
      at: item.citedAt ?? detail.run.startedAt,
      metadata: [item.linkedSpanId ?? '', item.linkedCheckpointId ?? ''].filter(Boolean),
      focusTarget: { kind: 'evidence' as const, id: item.id }
    })),
    ...detail.checkpoints.map(item => ({
      id: `checkpoint:${item.checkpointId}`,
      kind: 'checkpoint' as const,
      node: resolveNodeFromSpanIds(item.linkedSpanIds, traceNodeMap) ?? `stage:${item.stage ?? 'unknown'}`,
      stage: item.stage,
      title: item.checkpointId,
      summary: item.summary ?? 'checkpoint created',
      at: item.createdAt ?? detail.run.startedAt,
      status: item.recoverability,
      metadata: [item.recoverability ?? ''].filter(Boolean),
      focusTarget: { kind: 'checkpoint' as const, id: item.checkpointId }
    })),
    ...detail.diagnostics.map(item => ({
      id: `diagnostic:${item.id}`,
      kind: 'diagnostic' as const,
      node:
        (item.linkedSpanId ? traceNodeMap.get(item.linkedSpanId) : undefined) ??
        `stage:${item.linkedStage ?? 'unknown'}`,
      stage: item.linkedStage,
      title: item.title ?? item.kind ?? item.id,
      summary: item.summary ?? 'diagnostic emitted',
      at: item.detectedAt ?? detail.run.startedAt,
      status: item.severity ?? item.kind,
      metadata: [item.kind ?? '', item.severity ?? '', item.linkedCheckpointId ?? ''].filter(Boolean),
      focusTarget: item.linkedSpanId ? { kind: 'span' as const, id: item.linkedSpanId } : undefined
    })),
    ...detail.interrupts.map(item => ({
      id: `interrupt:${item.id}`,
      kind: 'interrupt' as const,
      node:
        (item.relatedSpanId ? traceNodeMap.get(item.relatedSpanId) : undefined) ?? `stage:${item.stage ?? 'unknown'}`,
      stage: item.stage,
      title: item.title ?? item.status ?? item.kind ?? item.id,
      summary: item.summary ?? item.feedback ?? 'interrupt raised',
      at: item.createdAt ?? detail.run.startedAt,
      status: item.status ?? item.kind,
      metadata: [item.kind ?? '', item.relatedCheckpointId ?? ''].filter(Boolean),
      focusTarget: item.relatedSpanId ? { kind: 'span' as const, id: item.relatedSpanId } : undefined
    }))
  ];

  return filterRowsByGraph(rows, graphFilter).sort((left, right) => left.at.localeCompare(right.at));
}
