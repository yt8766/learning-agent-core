import type { RunBundleRecord } from '@agent/core';

import type { RunObservatoryFocusTarget } from '@/pages/run-observatory/run-observatory-panel-support';

import type { AgentGraphOverlayFilter } from './runtime-agent-graph-overlay-support';
import {
  buildReplayDraftSeedFromStoryStep,
  type RuntimeRunWorkbenchReplayDraftSeed
} from './runtime-run-workbench-support';

export type RuntimeExecutionStoryStepKind =
  | 'timeline'
  | 'trace'
  | 'checkpoint'
  | 'evidence'
  | 'diagnostic'
  | 'interrupt'
  | 'artifact';

export interface RuntimeExecutionStoryStep {
  id: string;
  kind: RuntimeExecutionStoryStepKind;
  at: string;
  title: string;
  summary: string;
  stage?: string;
  status?: string;
  nodeLabel?: string;
  metadata: string[];
  focusTarget?: Exclude<RunObservatoryFocusTarget, undefined>;
  replayDraftSeed?: RuntimeRunWorkbenchReplayDraftSeed;
}

function buildTraceNodeMap(detail: RunBundleRecord) {
  return new Map(detail.traces.map(trace => [trace.spanId, trace.node]));
}

function resolveFirstDefined(values: Array<string | undefined>) {
  return values.find((value): value is string => Boolean(value));
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

function matchesGraphFilter(step: RuntimeExecutionStoryStep, graphFilter?: AgentGraphOverlayFilter) {
  if (!graphFilter) {
    return true;
  }

  if (step.focusTarget?.kind === 'span') {
    return graphFilter.spanIds.includes(step.focusTarget.id);
  }
  if (step.focusTarget?.kind === 'checkpoint') {
    return graphFilter.checkpointIds.includes(step.focusTarget.id);
  }
  if (step.focusTarget?.kind === 'evidence') {
    return graphFilter.evidenceIds.includes(step.focusTarget.id);
  }
  if (step.kind === 'diagnostic') {
    return graphFilter.diagnosticIds.includes(step.id.replace('diagnostic:', ''));
  }
  if (step.kind === 'interrupt') {
    return graphFilter.interruptIds.includes(step.id.replace('interrupt:', ''));
  }

  return graphFilter.stages.includes(step.stage ?? '');
}

function buildStepMetadata(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value));
}

export function buildRuntimeExecutionStory(params: {
  detail: RunBundleRecord;
  graphFilter?: AgentGraphOverlayFilter;
}): RuntimeExecutionStoryStep[] {
  const { detail, graphFilter } = params;
  const traceNodeMap = buildTraceNodeMap(detail);

  const steps: RuntimeExecutionStoryStep[] = [
    ...detail.timeline.map(item => ({
      id: `timeline:${item.id}`,
      kind: 'timeline' as const,
      at: item.startedAt ?? detail.run.startedAt,
      title: item.title,
      summary: item.summary,
      stage: item.stage,
      status: item.status,
      nodeLabel:
        item.actor?.displayName ??
        item.actor?.id ??
        (item.actor?.type ? `${item.actor.type}:${item.stage ?? 'runtime'}` : undefined),
      metadata: buildStepMetadata([
        item.actor?.type,
        typeof item.detail?.nodeCount === 'number' ? `${item.detail.nodeCount} nodes` : undefined,
        typeof item.detail?.retryCount === 'number' ? `${item.detail.retryCount} retries` : undefined,
        typeof item.detail?.evidenceCount === 'number' ? `${item.detail.evidenceCount} evidence` : undefined,
        typeof item.detail?.approvalCount === 'number' ? `${item.detail.approvalCount} approvals` : undefined
      ])
    })),
    ...detail.traces.map(item => ({
      id: `trace:${item.spanId}`,
      kind: 'trace' as const,
      at: item.startedAt,
      title: item.node,
      summary: item.summary,
      stage: item.stage,
      status: item.status,
      nodeLabel: item.node,
      metadata: buildStepMetadata([
        item.ministry,
        item.worker,
        item.modelUsed,
        typeof item.latencyMs === 'number' ? `${item.latencyMs}ms` : undefined
      ]),
      focusTarget: { kind: 'span' as const, id: item.spanId }
    })),
    ...detail.checkpoints.map(item => ({
      id: `checkpoint:${item.checkpointId}`,
      kind: 'checkpoint' as const,
      at: item.createdAt,
      title: item.nodeLabel ?? item.checkpointId,
      summary: item.summary,
      stage: item.stage,
      status: item.recoverability,
      nodeLabel: resolveNodeFromSpanIds(item.linkedSpanIds, traceNodeMap) ?? item.nodeLabel,
      metadata: buildStepMetadata([
        item.recoverable ? 'recoverable' : undefined,
        typeof item.pendingApprovalCount === 'number' ? `${item.pendingApprovalCount} approvals` : undefined,
        typeof item.evidenceCount === 'number' ? `${item.evidenceCount} evidence` : undefined
      ]),
      focusTarget: { kind: 'checkpoint' as const, id: item.checkpointId }
    })),
    ...detail.evidence.map(item => ({
      id: `evidence:${item.id}`,
      kind: 'evidence' as const,
      at: item.citedAt ?? detail.run.startedAt,
      title: item.title ?? item.sourceType ?? item.id,
      summary: item.summary,
      stage: item.stage,
      status: item.trustLevel,
      nodeLabel: item.linkedSpanId ? traceNodeMap.get(item.linkedSpanId) : undefined,
      metadata: buildStepMetadata([item.sourceType, item.trustLevel, item.linkedCheckpointId]),
      focusTarget: { kind: 'evidence' as const, id: item.id }
    })),
    ...detail.diagnostics.map(item => ({
      id: `diagnostic:${item.id}`,
      kind: 'diagnostic' as const,
      at: item.detectedAt,
      title: item.title,
      summary: item.summary,
      stage: item.linkedStage,
      status: item.severity,
      nodeLabel: resolveFirstDefined([item.linkedSpanId ? traceNodeMap.get(item.linkedSpanId) : undefined, item.kind]),
      metadata: buildStepMetadata([item.kind, item.suggestedAction?.label, item.linkedCheckpointId])
    })),
    ...detail.interrupts.map(item => ({
      id: `interrupt:${item.id}`,
      kind: 'interrupt' as const,
      at: item.createdAt,
      title: item.title,
      summary: item.summary,
      stage: item.stage,
      status: item.status,
      nodeLabel: resolveFirstDefined([
        item.relatedSpanId ? traceNodeMap.get(item.relatedSpanId) : undefined,
        item.actor?.displayName,
        item.actor?.id
      ]),
      metadata: buildStepMetadata([item.kind, item.feedback, item.relatedCheckpointId]),
      focusTarget: item.relatedSpanId
        ? { kind: 'span' as const, id: item.relatedSpanId }
        : item.relatedCheckpointId
          ? { kind: 'checkpoint' as const, id: item.relatedCheckpointId }
          : undefined
    })),
    ...detail.artifacts.map(item => ({
      id: `artifact:${item.id}`,
      kind: 'artifact' as const,
      at: item.createdAt,
      title: item.title,
      summary: item.summary ?? item.content ?? 'artifact produced',
      stage: detail.run.currentStage,
      status: item.type,
      metadata: buildStepMetadata([item.type])
    }))
  ];

  const scopedSteps = steps
    .filter(step => matchesGraphFilter(step, graphFilter))
    .sort((left, right) => left.at.localeCompare(right.at));

  return scopedSteps.map(step => ({
    ...step,
    replayDraftSeed: buildReplayDraftSeedFromStoryStep({
      runGoal: detail.run.goal,
      step
    })
  }));
}
