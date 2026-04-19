import type { RunBundleRecord } from '@agent/core';
import type { AgentGraphOverlayFilter } from '@/features/runtime-overview/components/runtime-agent-graph-overlay-support';

type RunSummaryRecord = RunBundleRecord['run'];

export type RunObservatorySummaryComparison = {
  baselineTaskId: string;
  baselineGoal: string;
  baselineStatus: string;
  currentStatus: string;
  durationDeltaMs?: number;
  stageChanged: boolean;
  currentStage?: string;
  baselineStage?: string;
  currentModels: string[];
  baselineModels: string[];
  addedFlags: string[];
  removedFlags: string[];
  addedDiagnostics: string[];
  removedDiagnostics: string[];
};

export type RunObservatoryDetailComparison = {
  traceDelta: number;
  checkpointDelta: number;
  interruptDelta: number;
  evidenceDelta: number;
  diagnosticDelta: number;
  timelineDelta: number;
  addedTraceNodes: string[];
  removedTraceNodes: string[];
  addedDiagnosticKinds: string[];
  removedDiagnosticKinds: string[];
  addedInterruptKinds: string[];
  removedInterruptKinds: string[];
  addedEvidenceSources: string[];
  removedEvidenceSources: string[];
  itemDiffs: {
    addedTraces: RunObservatoryItemDiffEntry[];
    removedTraces: RunObservatoryItemDiffEntry[];
    addedCheckpoints: RunObservatoryItemDiffEntry[];
    removedCheckpoints: RunObservatoryItemDiffEntry[];
    addedDiagnostics: RunObservatoryItemDiffEntry[];
    removedDiagnostics: RunObservatoryItemDiffEntry[];
    addedEvidence: RunObservatoryItemDiffEntry[];
    removedEvidence: RunObservatoryItemDiffEntry[];
    addedInterrupts: RunObservatoryItemDiffEntry[];
    removedInterrupts: RunObservatoryItemDiffEntry[];
  };
  fieldDiffs: {
    traces: RunObservatoryFieldDiffEntry[];
    checkpoints: RunObservatoryFieldDiffEntry[];
    diagnostics: RunObservatoryFieldDiffEntry[];
    evidence: RunObservatoryFieldDiffEntry[];
    interrupts: RunObservatoryFieldDiffEntry[];
  };
};

export type RunObservatoryItemDiffEntry = {
  id: string;
  label: string;
  summary: string;
};

export type RunObservatoryFieldDiffEntry = {
  id: string;
  label: string;
  changes: Array<{
    field: string;
    baseline: string;
    current: string;
  }>;
};

function collectRunFlags(run: RunSummaryRecord) {
  return [
    run.hasInterrupt ? 'interrupt' : undefined,
    run.hasFallback ? 'fallback' : undefined,
    run.hasRecoverableCheckpoint ? 'recoverable' : undefined,
    run.hasEvidenceWarning ? 'evidence_warning' : undefined
  ].filter((value): value is string => typeof value === 'string');
}

function collectRunModels(run: RunSummaryRecord) {
  const models =
    run.modelRoute?.map(item => item.selectedModel).filter((value): value is string => Boolean(value)) ?? [];
  return Array.from(new Set(models));
}

function diffValues(current: string[], baseline: string[]) {
  return {
    added: current.filter(item => !baseline.includes(item)),
    removed: baseline.filter(item => !current.includes(item))
  };
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

function diffById<T extends { id: string }>(current: T[], baseline: T[]) {
  const baselineIds = new Set(baseline.map(item => item.id));
  const currentIds = new Set(current.map(item => item.id));
  return {
    added: current.filter(item => !baselineIds.has(item.id)),
    removed: baseline.filter(item => !currentIds.has(item.id))
  };
}

function toDisplayValue(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return 'n/a';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function buildFieldDiffs<T extends { id: string }>(
  current: T[],
  baseline: T[],
  options: {
    label: (item: T) => string;
    fields: Array<{ key: keyof T; label: string }>;
  }
): RunObservatoryFieldDiffEntry[] {
  const baselineMap = new Map(baseline.map(item => [item.id, item]));

  return current.flatMap(item => {
    const baselineItem = baselineMap.get(item.id);
    if (!baselineItem) {
      return [];
    }

    const changes = options.fields.flatMap(field => {
      const currentValue = item[field.key];
      const baselineValue = baselineItem[field.key];
      if (currentValue === baselineValue) {
        return [];
      }
      return [
        {
          field: field.label,
          baseline: toDisplayValue(baselineValue),
          current: toDisplayValue(currentValue)
        }
      ];
    });

    if (!changes.length) {
      return [];
    }

    return [
      {
        id: item.id,
        label: options.label(item),
        changes
      }
    ];
  });
}

function toTraceDiffEntry(item: RunBundleRecord['traces'][number]): RunObservatoryItemDiffEntry {
  return {
    id: item.spanId,
    label: item.node,
    summary: [item.stage, item.status, item.modelUsed].filter(Boolean).join(' / ') || item.summary
  };
}

function toCheckpointDiffEntry(item: RunBundleRecord['checkpoints'][number]): RunObservatoryItemDiffEntry {
  return {
    id: item.checkpointId,
    label: item.checkpointId,
    summary: `${item.recoverability} / ${item.summary}`
  };
}

function toDiagnosticDiffEntry(item: RunBundleRecord['diagnostics'][number]): RunObservatoryItemDiffEntry {
  return {
    id: item.id,
    label: item.title,
    summary: `${item.kind} / ${item.severity}`
  };
}

function toEvidenceDiffEntry(item: RunBundleRecord['evidence'][number]): RunObservatoryItemDiffEntry {
  return {
    id: item.id,
    label: item.title ?? item.id,
    summary: [item.sourceType, item.trustLevel, item.summary].filter(Boolean).join(' / ')
  };
}

function toInterruptDiffEntry(item: RunBundleRecord['interrupts'][number]): RunObservatoryItemDiffEntry {
  return {
    id: item.id,
    label: item.title,
    summary: `${item.kind} / ${item.status}`
  };
}

export function buildRunSummaryComparison(
  current: RunSummaryRecord,
  baseline: RunSummaryRecord
): RunObservatorySummaryComparison {
  const currentFlags = collectRunFlags(current);
  const baselineFlags = collectRunFlags(baseline);
  const currentModels = collectRunModels(current);
  const baselineModels = collectRunModels(baseline);
  const diagnosticDiff = diffValues(current.diagnosticFlags, baseline.diagnosticFlags);
  const flagDiff = diffValues(currentFlags, baselineFlags);

  return {
    baselineTaskId: baseline.taskId,
    baselineGoal: baseline.goal,
    baselineStatus: baseline.status,
    currentStatus: current.status,
    durationDeltaMs:
      typeof current.durationMs === 'number' && typeof baseline.durationMs === 'number'
        ? current.durationMs - baseline.durationMs
        : undefined,
    stageChanged: current.currentStage !== baseline.currentStage,
    currentStage: current.currentStage,
    baselineStage: baseline.currentStage,
    currentModels,
    baselineModels,
    addedFlags: flagDiff.added,
    removedFlags: flagDiff.removed,
    addedDiagnostics: diagnosticDiff.added,
    removedDiagnostics: diagnosticDiff.removed
  };
}

export function buildRunDetailComparison(
  current: RunBundleRecord,
  baseline: RunBundleRecord
): RunObservatoryDetailComparison {
  const traceDiff = diffValues(
    uniqueValues(current.traces.map(item => item.node)),
    uniqueValues(baseline.traces.map(item => item.node))
  );
  const diagnosticDiff = diffValues(
    uniqueValues(current.diagnostics.map(item => item.kind)),
    uniqueValues(baseline.diagnostics.map(item => item.kind))
  );
  const interruptDiff = diffValues(
    uniqueValues(current.interrupts.map(item => item.kind)),
    uniqueValues(baseline.interrupts.map(item => item.kind))
  );
  const evidenceDiff = diffValues(
    uniqueValues(current.evidence.map(item => item.sourceType ?? item.title ?? item.id)),
    uniqueValues(baseline.evidence.map(item => item.sourceType ?? item.title ?? item.id))
  );
  const traceItemDiff = diffById(
    current.traces.map(item => ({ id: item.spanId, item })),
    baseline.traces.map(item => ({ id: item.spanId, item }))
  );
  const checkpointItemDiff = diffById(
    current.checkpoints.map(item => ({ id: item.checkpointId, item })),
    baseline.checkpoints.map(item => ({ id: item.checkpointId, item }))
  );
  const diagnosticItemDiff = diffById(
    current.diagnostics.map(item => ({ id: item.id, item })),
    baseline.diagnostics.map(item => ({ id: item.id, item }))
  );
  const evidenceItemDiff = diffById(
    current.evidence.map(item => ({ id: item.id, item })),
    baseline.evidence.map(item => ({ id: item.id, item }))
  );
  const interruptItemDiff = diffById(
    current.interrupts.map(item => ({ id: item.id, item })),
    baseline.interrupts.map(item => ({ id: item.id, item }))
  );

  return {
    traceDelta: current.traces.length - baseline.traces.length,
    checkpointDelta: current.checkpoints.length - baseline.checkpoints.length,
    interruptDelta: current.interrupts.length - baseline.interrupts.length,
    evidenceDelta: current.evidence.length - baseline.evidence.length,
    diagnosticDelta: current.diagnostics.length - baseline.diagnostics.length,
    timelineDelta: current.timeline.length - baseline.timeline.length,
    addedTraceNodes: traceDiff.added,
    removedTraceNodes: traceDiff.removed,
    addedDiagnosticKinds: diagnosticDiff.added,
    removedDiagnosticKinds: diagnosticDiff.removed,
    addedInterruptKinds: interruptDiff.added,
    removedInterruptKinds: interruptDiff.removed,
    addedEvidenceSources: evidenceDiff.added,
    removedEvidenceSources: evidenceDiff.removed,
    itemDiffs: {
      addedTraces: traceItemDiff.added.map(({ item }) => toTraceDiffEntry(item)),
      removedTraces: traceItemDiff.removed.map(({ item }) => toTraceDiffEntry(item)),
      addedCheckpoints: checkpointItemDiff.added.map(({ item }) => toCheckpointDiffEntry(item)),
      removedCheckpoints: checkpointItemDiff.removed.map(({ item }) => toCheckpointDiffEntry(item)),
      addedDiagnostics: diagnosticItemDiff.added.map(({ item }) => toDiagnosticDiffEntry(item)),
      removedDiagnostics: diagnosticItemDiff.removed.map(({ item }) => toDiagnosticDiffEntry(item)),
      addedEvidence: evidenceItemDiff.added.map(({ item }) => toEvidenceDiffEntry(item)),
      removedEvidence: evidenceItemDiff.removed.map(({ item }) => toEvidenceDiffEntry(item)),
      addedInterrupts: interruptItemDiff.added.map(({ item }) => toInterruptDiffEntry(item)),
      removedInterrupts: interruptItemDiff.removed.map(({ item }) => toInterruptDiffEntry(item))
    },
    fieldDiffs: {
      traces: buildFieldDiffs(
        current.traces.map(item => ({ id: item.spanId, ...item })),
        baseline.traces.map(item => ({ id: item.spanId, ...item })),
        {
          label: item => item.node,
          fields: [
            { key: 'status', label: 'status' },
            { key: 'stage', label: 'stage' },
            { key: 'modelUsed', label: 'model' },
            { key: 'summary', label: 'summary' },
            { key: 'latencyMs', label: 'latencyMs' }
          ]
        }
      ),
      checkpoints: buildFieldDiffs(
        current.checkpoints.map(item => ({ id: item.checkpointId, ...item })),
        baseline.checkpoints.map(item => ({ id: item.checkpointId, ...item })),
        {
          label: item => item.checkpointId,
          fields: [
            { key: 'recoverability', label: 'recoverability' },
            { key: 'recoverable', label: 'recoverable' },
            { key: 'summary', label: 'summary' }
          ]
        }
      ),
      diagnostics: buildFieldDiffs(current.diagnostics, baseline.diagnostics, {
        label: item => item.title,
        fields: [
          { key: 'kind', label: 'kind' },
          { key: 'severity', label: 'severity' },
          { key: 'summary', label: 'summary' }
        ]
      }),
      evidence: buildFieldDiffs(current.evidence, baseline.evidence, {
        label: item => item.title ?? item.id,
        fields: [
          { key: 'sourceType', label: 'sourceType' },
          { key: 'trustLevel', label: 'trustLevel' },
          { key: 'summary', label: 'summary' }
        ]
      }),
      interrupts: buildFieldDiffs(current.interrupts, baseline.interrupts, {
        label: item => item.title,
        fields: [
          { key: 'kind', label: 'kind' },
          { key: 'status', label: 'status' },
          { key: 'summary', label: 'summary' }
        ]
      })
    }
  };
}

export function filterRunBundleByGraphFilter(
  detail: RunBundleRecord,
  filter?: AgentGraphOverlayFilter
): RunBundleRecord {
  if (!filter) {
    return detail;
  }

  return {
    ...detail,
    timeline: detail.timeline.filter(item => filter.stages.includes(item.stage)),
    traces: detail.traces.filter(item => filter.spanIds.includes(item.spanId)),
    checkpoints: detail.checkpoints.filter(item => filter.checkpointIds.includes(item.checkpointId)),
    interrupts: detail.interrupts.filter(item => filter.interruptIds.includes(item.id)),
    diagnostics: detail.diagnostics.filter(item => filter.diagnosticIds.includes(item.id)),
    evidence: detail.evidence.filter(item => filter.evidenceIds.includes(item.id))
  };
}

export function formatDurationDelta(durationDeltaMs?: number) {
  if (typeof durationDeltaMs !== 'number' || durationDeltaMs === 0) {
    return 'same duration';
  }
  const seconds = Math.round(Math.abs(durationDeltaMs) / 1000);
  return durationDeltaMs > 0 ? `+${seconds}s slower` : `${seconds}s faster`;
}
