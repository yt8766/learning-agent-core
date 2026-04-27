import type { RunBundleRecord } from '@agent/core';

export type {
  AgentToolObservatoryDetail,
  AgentToolObservatoryFilter,
  AgentToolObservatoryItem
} from './run-observatory-agent-tools';
export { buildAgentToolObservatoryDetail } from './run-observatory-agent-tools';

export type RunObservatoryFocusTarget =
  | {
      kind: 'checkpoint';
      id: string;
    }
  | {
      kind: 'span';
      id: string;
    }
  | {
      kind: 'evidence';
      id: string;
    }
  | undefined;

export function buildFocusTarget(input: {
  checkpointId?: string;
  spanId?: string;
  evidenceId?: string;
}): RunObservatoryFocusTarget {
  if (input.checkpointId) {
    return {
      kind: 'checkpoint',
      id: input.checkpointId
    };
  }

  if (input.spanId) {
    return {
      kind: 'span',
      id: input.spanId
    };
  }

  if (input.evidenceId) {
    return {
      kind: 'evidence',
      id: input.evidenceId
    };
  }

  return undefined;
}

export function isFocusedTarget(
  current: RunObservatoryFocusTarget,
  candidate: Exclude<RunObservatoryFocusTarget, undefined>
) {
  return current?.kind === candidate.kind && current.id === candidate.id;
}

export function buildFocusDomId(target: Exclude<RunObservatoryFocusTarget, undefined>) {
  return `run-observatory-${target.kind}-${encodeURIComponent(target.id)}`;
}

function isPresent(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export type RunObservatoryFocusDetail = {
  target: Exclude<RunObservatoryFocusTarget, undefined>;
  title: string;
  summary: string;
  metadata: string[];
  relatedCounts: {
    timeline: number;
    interrupts: number;
    diagnostics: number;
    evidence: number;
    spans: number;
    checkpoints: number;
  };
  relatedTargets: Array<{
    label: string;
    target: Exclude<RunObservatoryFocusTarget, undefined>;
  }>;
};

function dedupeRelatedTargets(
  targets: Array<{
    label: string;
    target: Exclude<RunObservatoryFocusTarget, undefined>;
  }>
) {
  const seen = new Set<string>();
  return targets.filter(item => {
    const key = `${item.target.kind}:${item.target.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildFocusDetail(
  detail: RunBundleRecord,
  focusTarget: RunObservatoryFocusTarget
): RunObservatoryFocusDetail | undefined {
  if (!focusTarget) {
    return undefined;
  }

  if (focusTarget.kind === 'checkpoint') {
    const checkpoint = detail.checkpoints.find(item => item.checkpointId === focusTarget.id);
    if (!checkpoint) {
      return undefined;
    }

    const linkedSpans = detail.traces.filter(
      trace => trace.checkpointId === checkpoint.checkpointId || checkpoint.linkedSpanIds?.includes(trace.spanId)
    );
    const linkedEvidence = detail.evidence.filter(item => item.linkedCheckpointId === checkpoint.checkpointId);
    const linkedInterrupts = detail.interrupts.filter(item => item.relatedCheckpointId === checkpoint.checkpointId);
    const linkedDiagnostics = detail.diagnostics.filter(item => item.linkedCheckpointId === checkpoint.checkpointId);
    const linkedTimeline = detail.timeline.filter(item => item.linkedCheckpointIds?.includes(checkpoint.checkpointId));

    return {
      target: focusTarget,
      title: `Checkpoint ${checkpoint.checkpointId}`,
      summary: checkpoint.summary,
      metadata: [checkpoint.recoverability, checkpoint.stage ?? 'stage n/a'].filter(isPresent),
      relatedCounts: {
        timeline: linkedTimeline.length,
        interrupts: linkedInterrupts.length,
        diagnostics: linkedDiagnostics.length,
        evidence: linkedEvidence.length,
        spans: linkedSpans.length,
        checkpoints: 1
      },
      relatedTargets: dedupeRelatedTargets([
        ...linkedSpans.map(span => ({
          label: `span ${span.spanId}`,
          target: { kind: 'span' as const, id: span.spanId }
        })),
        ...linkedEvidence.map(item => ({
          label: `evidence ${item.title ?? item.id}`,
          target: { kind: 'evidence' as const, id: item.id }
        }))
      ])
    };
  }

  if (focusTarget.kind === 'span') {
    const span = detail.traces.find(item => item.spanId === focusTarget.id);
    if (!span) {
      return undefined;
    }

    const linkedCheckpoints = detail.checkpoints.filter(
      item => item.checkpointId === span.checkpointId || item.linkedSpanIds?.includes(span.spanId)
    );
    const linkedEvidence = detail.evidence.filter(
      item => item.linkedSpanId === span.spanId || span.evidenceIds?.includes(item.id)
    );
    const linkedInterrupts = detail.interrupts.filter(item => item.relatedSpanId === span.spanId);
    const linkedDiagnostics = detail.diagnostics.filter(item => item.linkedSpanId === span.spanId);
    const linkedTimeline = detail.timeline.filter(item => item.linkedSpanIds?.includes(span.spanId));

    return {
      target: focusTarget,
      title: `Span ${span.node}`,
      summary: span.summary,
      metadata: [span.stage, span.status, span.modelUsed].filter(isPresent),
      relatedCounts: {
        timeline: linkedTimeline.length,
        interrupts: linkedInterrupts.length,
        diagnostics: linkedDiagnostics.length,
        evidence: linkedEvidence.length,
        spans: 1,
        checkpoints: linkedCheckpoints.length
      },
      relatedTargets: dedupeRelatedTargets([
        ...linkedCheckpoints.map(item => ({
          label: `checkpoint ${item.checkpointId}`,
          target: { kind: 'checkpoint' as const, id: item.checkpointId }
        })),
        ...linkedEvidence.map(item => ({
          label: `evidence ${item.title ?? item.id}`,
          target: { kind: 'evidence' as const, id: item.id }
        }))
      ])
    };
  }

  const evidence = detail.evidence.find(item => item.id === focusTarget.id);
  if (!evidence) {
    return undefined;
  }

  const linkedSpans = detail.traces.filter(item => item.spanId === evidence.linkedSpanId);
  const linkedCheckpoints = detail.checkpoints.filter(item => item.checkpointId === evidence.linkedCheckpointId);
  const linkedTimeline = detail.timeline.filter(item => item.linkedEvidenceIds?.includes(evidence.id));

  return {
    target: focusTarget,
    title: `Evidence ${evidence.title ?? evidence.id}`,
    summary: evidence.summary,
    metadata: [evidence.sourceType, evidence.trustLevel, evidence.stage].filter(isPresent),
    relatedCounts: {
      timeline: linkedTimeline.length,
      interrupts: 0,
      diagnostics: 0,
      evidence: 1,
      spans: linkedSpans.length,
      checkpoints: linkedCheckpoints.length
    },
    relatedTargets: dedupeRelatedTargets([
      ...linkedCheckpoints.map(item => ({
        label: `checkpoint ${item.checkpointId}`,
        target: { kind: 'checkpoint' as const, id: item.checkpointId }
      })),
      ...linkedSpans.map(item => ({
        label: `span ${item.spanId}`,
        target: { kind: 'span' as const, id: item.spanId }
      }))
    ])
  };
}
