import type { RunCheckpointSummaryRecord, RunStage, RunTraceSpanRecord } from '@agent/core';

export function findLatestCheckpoint(
  checkpoints: RunCheckpointSummaryRecord[]
): RunCheckpointSummaryRecord | undefined {
  return checkpoints[checkpoints.length - 1];
}

function getComparableTime(value?: string) {
  if (!value) {
    return Number.NaN;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.NaN : time;
}

export function findNearestTraceAtOrBefore(traces: RunTraceSpanRecord[], at?: string): RunTraceSpanRecord | undefined {
  const targetTime = getComparableTime(at);
  if (Number.isNaN(targetTime)) {
    return traces[traces.length - 1];
  }

  let best: RunTraceSpanRecord | undefined;
  let bestTime = Number.NEGATIVE_INFINITY;
  for (const trace of traces) {
    const traceTime = getComparableTime(trace.startedAt);
    if (Number.isNaN(traceTime) || traceTime > targetTime || traceTime < bestTime) {
      continue;
    }
    best = trace;
    bestTime = traceTime;
  }

  return best ?? traces[traces.length - 1];
}

export function resolveRelatedStage(input: {
  trace?: RunTraceSpanRecord;
  checkpoint?: RunCheckpointSummaryRecord;
  fallbackStage?: RunStage;
}): RunStage | undefined {
  return input.trace?.stage ?? input.checkpoint?.stage ?? input.fallbackStage;
}
