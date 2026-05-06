import type { RunBundleRecord } from '@agent/core';

import type { ArchitectureDiagramRecord } from '@/types/admin';
import type { RunObservatoryFocusTarget } from '@/pages/run-observatory/run-observatory-panel-support';
import {
  buildReplayDraftSeedFromGraphNode,
  type RuntimeRunWorkbenchReplayDraftSeed
} from './runtime-run-workbench-support';

type OverlayStatus = 'idle' | 'active' | 'current';

export interface AgentGraphOverlayNode {
  id: string;
  label: string;
  subgraphTitle: string;
  status: OverlayStatus;
  summary: string;
  focusTarget?: Exclude<RunObservatoryFocusTarget, undefined>;
  filter: AgentGraphOverlayFilter;
  replayDraftSeed?: RuntimeRunWorkbenchReplayDraftSeed;
}

export interface AgentGraphOverlayFilter {
  nodeId: string;
  label: string;
  stages: string[];
  spanIds: string[];
  checkpointIds: string[];
  evidenceIds: string[];
  diagnosticIds: string[];
  interruptIds: string[];
}

function collectCandidateNodeIds(detail: RunBundleRecord) {
  const candidateIds = new Set<string>(Object.keys(NODE_STAGE_MAP));

  for (const trace of detail.traces) {
    if (trace.ministry) {
      candidateIds.add(`worker-${trace.ministry}`);
    }
    if (trace.worker) {
      candidateIds.add(`worker-${trace.worker}`);
    }
  }

  for (const route of detail.run.modelRoute ?? []) {
    if (route.ministry) {
      candidateIds.add(`worker-${route.ministry}`);
    }
  }

  if (detail.run.currentMinistry) {
    candidateIds.add(`worker-${detail.run.currentMinistry}`);
  }
  if (detail.run.workflow?.id) {
    candidateIds.add(`workflow-${detail.run.workflow.id}`);
  }

  return [...candidateIds];
}

function scoreFilterMatch(filter: AgentGraphOverlayFilter, target: Exclude<RunObservatoryFocusTarget, undefined>) {
  if (target.kind === 'span') {
    if (filter.nodeId.startsWith('worker-') && filter.spanIds.includes(target.id)) {
      return 4;
    }
    if (filter.spanIds.includes(target.id)) {
      return 3;
    }
  }

  if (target.kind === 'checkpoint') {
    if (filter.checkpointIds.includes(target.id) && filter.nodeId.startsWith('worker-')) {
      return 4;
    }
    if (filter.checkpointIds.includes(target.id)) {
      return 3;
    }
  }

  if (target.kind === 'evidence') {
    if (filter.evidenceIds.includes(target.id) && filter.nodeId.startsWith('worker-')) {
      return 4;
    }
    if (filter.evidenceIds.includes(target.id)) {
      return 3;
    }
  }

  return 0;
}

export function buildAgentGraphOverlayFilter(params: {
  detail: RunBundleRecord;
  nodeId: string;
  label?: string;
}): AgentGraphOverlayFilter {
  const { detail, nodeId, label } = params;
  const resolvedLabel =
    label ??
    (nodeId === `workflow-${detail.run.workflow?.id}`
      ? (detail.run.workflow?.displayName ?? detail.run.workflow?.id)
      : undefined) ??
    nodeId;
  const stages = NODE_STAGE_MAP[nodeId] ?? [];
  const workerName = nodeId.startsWith('worker-') ? nodeId.replace('worker-', '') : undefined;
  const spanIds = workerName
    ? detail.traces.filter(item => item.ministry === workerName || item.worker === workerName).map(item => item.spanId)
    : detail.traces.filter(item => stages.includes(item.stage)).map(item => item.spanId);
  const checkpointIds = detail.checkpoints
    .filter(
      item => (item.stage ? stages.includes(item.stage) : false) || item.linkedSpanIds?.some(id => spanIds.includes(id))
    )
    .map(item => item.checkpointId);
  const evidenceIds = detail.evidence
    .filter(
      item =>
        (item.stage ? stages.includes(item.stage) : false) ||
        (item.linkedSpanId ? spanIds.includes(item.linkedSpanId) : false) ||
        (item.linkedCheckpointId ? checkpointIds.includes(item.linkedCheckpointId) : false)
    )
    .map(item => item.id);
  const diagnosticIds = detail.diagnostics
    .filter(
      item =>
        (item.linkedStage ? stages.includes(item.linkedStage) : false) ||
        (item.linkedSpanId ? spanIds.includes(item.linkedSpanId) : false) ||
        (item.linkedCheckpointId ? checkpointIds.includes(item.linkedCheckpointId) : false)
    )
    .map(item => item.id);
  const interruptIds = detail.interrupts
    .filter(
      item =>
        (item.stage ? stages.includes(item.stage) : false) ||
        (item.relatedSpanId ? spanIds.includes(item.relatedSpanId) : false) ||
        (item.relatedCheckpointId ? checkpointIds.includes(item.relatedCheckpointId) : false)
    )
    .map(item => item.id);

  return {
    nodeId,
    label: resolvedLabel,
    stages,
    spanIds,
    checkpointIds,
    evidenceIds,
    diagnosticIds,
    interruptIds
  };
}

const NODE_STAGE_MAP: Record<string, string[]> = {
  'entry-router': ['route'],
  'budget-gate': ['plan', 'route'],
  'mode-gate': ['plan', 'route'],
  'complex-task-plan': ['plan'],
  'dispatch-planner': ['route', 'research', 'execution'],
  'context-filter': ['route', 'research'],
  'result-aggregator': ['review', 'delivery'],
  critic: ['review'],
  'xingbu-final': ['review'],
  'libu-delivery': ['delivery'],
  'interrupt-controller': ['interrupt', 'recover'],
  'learning-recorder': ['learning'],
  'strategy-layer': ['research', 'execution'],
  'ministry-layer': ['research', 'execution', 'review'],
  'fallback-layer': ['execution', 'review'],
  blackboard: ['route', 'research', 'execution', 'review', 'delivery'],
  sandbox: ['execution', 'review']
};

function getSubgraphTitle(diagram: ArchitectureDiagramRecord, subgraphId?: string) {
  return diagram.descriptor.subgraphs.find(item => item.id === subgraphId)?.title ?? 'Ungrouped';
}

function buildNodeSummary(nodeId: string, detail: RunBundleRecord) {
  if (nodeId === `workflow-${detail.run.workflow?.id}` && detail.run.workflow) {
    return `${detail.run.workflow.displayName ?? detail.run.workflow.id} / ${detail.run.currentStage ?? 'n/a'}`;
  }

  if (nodeId.startsWith('worker-')) {
    const ministry = nodeId.replace('worker-', '');
    const traces = detail.traces.filter(item => item.ministry === ministry || item.worker === ministry);
    if (traces.length) {
      return traces
        .slice(0, 2)
        .map(item => `${item.node}: ${item.status}`)
        .join(' / ');
    }
    return `${ministry} is part of this workflow route.`;
  }

  const relatedStages = NODE_STAGE_MAP[nodeId] ?? [];
  const stageMatches = detail.timeline.filter(item => relatedStages.includes(item.stage));
  if (stageMatches.length) {
    return stageMatches
      .slice(0, 2)
      .map(item => `${item.stage}: ${item.summary}`)
      .join(' / ');
  }

  if (nodeId === 'blackboard' && detail.checkpoints.length) {
    return `${detail.checkpoints.length} checkpoint / ${detail.evidence.length} evidence`;
  }

  return 'This node has no direct runtime projection for the current run.';
}

function resolveOverlayStatus(nodeId: string, detail: RunBundleRecord): OverlayStatus {
  if (nodeId === `workflow-${detail.run.workflow?.id}`) {
    return 'current';
  }

  if (nodeId.startsWith('worker-')) {
    const ministry = nodeId.replace('worker-', '');
    if (detail.run.currentMinistry === ministry) {
      return 'current';
    }
    const involved = detail.run.modelRoute?.some(item => item.ministry === ministry);
    return involved ? 'active' : 'idle';
  }

  const relatedStages = NODE_STAGE_MAP[nodeId] ?? [];
  if (detail.run.currentStage && relatedStages.includes(detail.run.currentStage)) {
    return 'current';
  }
  if (detail.timeline.some(item => relatedStages.includes(item.stage))) {
    return 'active';
  }
  if (nodeId === 'blackboard' && (detail.checkpoints.length || detail.evidence.length)) {
    return 'active';
  }
  return 'idle';
}

function resolveNodeFocusTarget(
  nodeId: string,
  detail: RunBundleRecord
): Exclude<RunObservatoryFocusTarget, undefined> | undefined {
  if (nodeId.startsWith('worker-')) {
    const ministry = nodeId.replace('worker-', '');
    const trace = detail.traces.find(item => item.ministry === ministry || item.worker === ministry);
    if (trace) {
      return { kind: 'span', id: trace.spanId };
    }
  }

  const relatedStages = NODE_STAGE_MAP[nodeId] ?? [];
  const stageTrace = detail.traces.find(item => relatedStages.includes(item.stage));
  if (stageTrace) {
    return { kind: 'span', id: stageTrace.spanId };
  }

  const stageCheckpoint = detail.checkpoints.find(item => item.stage && relatedStages.includes(item.stage));
  if (stageCheckpoint) {
    return { kind: 'checkpoint', id: stageCheckpoint.checkpointId };
  }

  const stageEvidence = detail.evidence.find(item => item.stage && relatedStages.includes(item.stage));
  if (stageEvidence) {
    return { kind: 'evidence', id: stageEvidence.id };
  }

  return undefined;
}

export function buildAgentGraphOverlay(params: {
  diagram: ArchitectureDiagramRecord;
  detail: RunBundleRecord;
}): AgentGraphOverlayNode[] {
  const { diagram, detail } = params;

  return diagram.descriptor.nodes
    .filter(node => node.subgraphId !== undefined)
    .map(node => ({
      id: node.id,
      label: node.label,
      subgraphTitle: getSubgraphTitle(diagram, node.subgraphId),
      status: resolveOverlayStatus(node.id, detail),
      summary: buildNodeSummary(node.id, detail),
      focusTarget: resolveNodeFocusTarget(node.id, detail),
      filter: buildAgentGraphOverlayFilter({ detail, nodeId: node.id, label: node.label }),
      replayDraftSeed: buildReplayDraftSeedFromGraphNode({
        runGoal: detail.run.goal,
        node: {
          id: node.id,
          label: node.label,
          summary: buildNodeSummary(node.id, detail),
          status: resolveOverlayStatus(node.id, detail),
          subgraphTitle: getSubgraphTitle(diagram, node.subgraphId)
        }
      })
    }))
    .filter(node => node.status !== 'idle' || node.id === `workflow-${detail.run.workflow?.id}`);
}

export function resolveGraphFilterForFocusTarget(params: {
  detail: RunBundleRecord;
  target: Exclude<RunObservatoryFocusTarget, undefined>;
}): AgentGraphOverlayFilter | undefined {
  const { detail, target } = params;
  const candidates = collectCandidateNodeIds(detail)
    .map(nodeId => buildAgentGraphOverlayFilter({ detail, nodeId }))
    .map(filter => ({
      filter,
      score: scoreFilterMatch(filter, target)
    }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || right.filter.spanIds.length - left.filter.spanIds.length);

  return candidates[0]?.filter;
}
