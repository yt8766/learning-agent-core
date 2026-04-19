import { resolve } from 'node:path';

import fs from 'fs-extra';

export type PlatformConsoleLogEventName = 'runtime.platform_console.fresh_aggregate' | 'runtime.platform_console.slow';

export interface PlatformConsoleLogSample {
  event: PlatformConsoleLogEventName;
  timestamp: string;
  context?: string;
  days?: number;
  cacheStatus?: string;
  totalDurationMs: number;
  thresholdMs?: number;
  taskCount?: number;
  sessionCount?: number;
  timingsMs: Record<string, number>;
  filters?: Record<string, unknown>;
}

export interface PlatformConsoleLogAggregate {
  count: number;
  totalDurationMs: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
  };
  timingPercentilesMs: Record<string, { p50: number; p95: number; max: number }>;
}

export interface PlatformConsoleLogAnalysis {
  sampleCount: number;
  summary: PlatformConsoleLogSummary;
  byEvent: Partial<Record<PlatformConsoleLogEventName, PlatformConsoleLogAggregate>>;
  latestSamples: PlatformConsoleLogSample[];
}

export interface PlatformConsoleLogSummary {
  status: 'healthy' | 'warning' | 'critical';
  reasons: string[];
  budgetsMs: {
    freshAggregateP95: number;
    slowP95: number;
  };
}

const PLATFORM_CONSOLE_LOG_BUDGETS_MS = {
  freshAggregateP95: 600,
  slowP95: 1200
} as const;

export async function collectPlatformConsoleLogAnalysis(options?: {
  logsDir?: string;
  days?: number;
  latestSampleLimit?: number;
}): Promise<PlatformConsoleLogAnalysis> {
  const files = await resolvePlatformConsoleLogFiles({
    logsDir: options?.logsDir ?? resolveBackendLogsDir(),
    days: options?.days ?? 7
  });
  const contents = await Promise.all(files.map(filePath => fs.readFile(filePath, 'utf8').catch(() => '')));
  const lines = contents.flatMap(content => content.split('\n'));
  return analyzePlatformConsoleLogs(lines, {
    latestSampleLimit: options?.latestSampleLimit
  });
}

export function resolveBackendLogsDir() {
  return resolve(__dirname, '..', '..', 'logs');
}

interface PersistedLogRecord {
  time?: string;
  context?: string;
  message?: string;
}

export function parsePlatformConsoleLogLine(line: string): PlatformConsoleLogSample | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  let record: PersistedLogRecord & Record<string, unknown>;
  try {
    record = JSON.parse(trimmed) as PersistedLogRecord & Record<string, unknown>;
  } catch {
    return null;
  }

  const parsedMessage = parseEmbeddedMessage(record.message);
  if (!parsedMessage) {
    return null;
  }
  if (!isPlatformConsoleEventName(parsedMessage.event)) {
    return null;
  }
  if (typeof parsedMessage.totalDurationMs !== 'number' || !Number.isFinite(parsedMessage.totalDurationMs)) {
    return null;
  }

  return {
    event: parsedMessage.event,
    timestamp: String(record.time ?? ''),
    context: typeof record.context === 'string' ? record.context : undefined,
    days: typeof parsedMessage.days === 'number' ? parsedMessage.days : undefined,
    cacheStatus: typeof parsedMessage.cacheStatus === 'string' ? parsedMessage.cacheStatus : undefined,
    totalDurationMs: parsedMessage.totalDurationMs,
    thresholdMs: typeof parsedMessage.thresholdMs === 'number' ? parsedMessage.thresholdMs : undefined,
    taskCount: typeof parsedMessage.taskCount === 'number' ? parsedMessage.taskCount : undefined,
    sessionCount: typeof parsedMessage.sessionCount === 'number' ? parsedMessage.sessionCount : undefined,
    timingsMs: normalizeTimingRecord(parsedMessage.timingsMs),
    filters: isRecord(parsedMessage.filters) ? parsedMessage.filters : undefined
  };
}

export function analyzePlatformConsoleLogs(
  lines: Iterable<string>,
  options?: { latestSampleLimit?: number }
): PlatformConsoleLogAnalysis {
  const samples = [...lines]
    .map(line => parsePlatformConsoleLogLine(line))
    .filter((sample): sample is PlatformConsoleLogSample => Boolean(sample))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  const byEvent = groupByEvent(samples);

  return {
    sampleCount: samples.length,
    summary: summarizeAnalysis(byEvent),
    byEvent,
    latestSamples: samples.slice(0, options?.latestSampleLimit ?? 5)
  };
}

export function formatPlatformConsoleLogAnalysis(analysis: PlatformConsoleLogAnalysis): string {
  if (analysis.sampleCount === 0) {
    return 'No platform console events found.';
  }

  const lines = [
    `Platform console log samples: ${analysis.sampleCount}`,
    `Summary: ${analysis.summary.status} (${analysis.summary.reasons.join('; ')})`
  ];
  for (const eventName of Object.keys(analysis.byEvent).sort()) {
    const aggregate = analysis.byEvent[eventName as PlatformConsoleLogEventName];
    if (!aggregate) {
      continue;
    }
    lines.push(
      `${eventName}: count=${aggregate.count} avg=${aggregate.totalDurationMs.avg}ms p50=${aggregate.totalDurationMs.p50}ms p95=${aggregate.totalDurationMs.p95}ms max=${aggregate.totalDurationMs.max}ms`
    );
    for (const timingKey of Object.keys(aggregate.timingPercentilesMs).sort()) {
      const timing = aggregate.timingPercentilesMs[timingKey]!;
      lines.push(`  ${timingKey}: p50=${timing.p50}ms p95=${timing.p95}ms max=${timing.max}ms`);
    }
  }

  if (analysis.latestSamples.length) {
    lines.push('Latest samples:');
    for (const sample of analysis.latestSamples) {
      lines.push(
        `  ${sample.timestamp} ${sample.event} total=${sample.totalDurationMs}ms cache=${sample.cacheStatus ?? 'unknown'} tasks=${sample.taskCount ?? 0} sessions=${sample.sessionCount ?? 0}`
      );
    }
  }

  return lines.join('\n');
}

function parseEmbeddedMessage(message: unknown): Record<string, unknown> | null {
  if (typeof message !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(message) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function groupByEvent(
  samples: PlatformConsoleLogSample[]
): Partial<Record<PlatformConsoleLogEventName, PlatformConsoleLogAggregate>> {
  const grouped = new Map<PlatformConsoleLogEventName, PlatformConsoleLogSample[]>();
  for (const sample of samples) {
    const current = grouped.get(sample.event) ?? [];
    current.push(sample);
    grouped.set(sample.event, current);
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([eventName, eventSamples]) => [eventName, summarizeSamples(eventSamples)])
  ) as Partial<Record<PlatformConsoleLogEventName, PlatformConsoleLogAggregate>>;
}

function summarizeAnalysis(
  byEvent: Partial<Record<PlatformConsoleLogEventName, PlatformConsoleLogAggregate>>
): PlatformConsoleLogSummary {
  const freshAggregate = byEvent['runtime.platform_console.fresh_aggregate'];
  const slow = byEvent['runtime.platform_console.slow'];
  const reasons: string[] = [];

  if (slow?.totalDurationMs.p95 && slow.totalDurationMs.p95 > PLATFORM_CONSOLE_LOG_BUDGETS_MS.slowP95) {
    reasons.push(`slow p95 ${slow.totalDurationMs.p95}ms exceeds ${PLATFORM_CONSOLE_LOG_BUDGETS_MS.slowP95}ms budget`);
  }
  if ((slow?.count ?? 0) > 0) {
    reasons.push(`slow event count ${slow?.count ?? 0} exceeds 0 budget`);
  }
  if (
    freshAggregate?.totalDurationMs.p95 &&
    freshAggregate.totalDurationMs.p95 > PLATFORM_CONSOLE_LOG_BUDGETS_MS.freshAggregateP95
  ) {
    reasons.push(
      `fresh p95 ${freshAggregate.totalDurationMs.p95}ms exceeds ${PLATFORM_CONSOLE_LOG_BUDGETS_MS.freshAggregateP95}ms budget`
    );
  }

  if (!reasons.length) {
    return {
      status: 'healthy',
      reasons: [
        freshAggregate
          ? `fresh p95 ${freshAggregate.totalDurationMs.p95}ms within ${PLATFORM_CONSOLE_LOG_BUDGETS_MS.freshAggregateP95}ms budget and no slow events detected`
          : 'no recent platform console samples exceeded the active budgets'
      ],
      budgetsMs: { ...PLATFORM_CONSOLE_LOG_BUDGETS_MS }
    };
  }

  return {
    status:
      (slow?.count ?? 0) > 0 || (slow?.totalDurationMs.p95 ?? 0) > PLATFORM_CONSOLE_LOG_BUDGETS_MS.slowP95
        ? 'critical'
        : 'warning',
    reasons,
    budgetsMs: { ...PLATFORM_CONSOLE_LOG_BUDGETS_MS }
  };
}

async function resolvePlatformConsoleLogFiles(options: { logsDir: string; days: number }) {
  const entries = await fs.readdir(options.logsDir).catch(() => []);
  return entries
    .filter(entry => /^performance-\d{4}-\d{2}-\d{2}\.log$/.test(entry))
    .sort()
    .slice(-Math.max(1, options.days))
    .map(entry => resolve(options.logsDir, entry));
}

function summarizeSamples(samples: PlatformConsoleLogSample[]): PlatformConsoleLogAggregate {
  const totalDurations = samples.map(sample => sample.totalDurationMs);
  const timingKeys = [...new Set(samples.flatMap(sample => Object.keys(sample.timingsMs)))].sort();

  return {
    count: samples.length,
    totalDurationMs: {
      min: roundMetric(Math.min(...totalDurations)),
      max: roundMetric(Math.max(...totalDurations)),
      avg: roundMetric(totalDurations.reduce((sum, value) => sum + value, 0) / samples.length),
      p50: percentile(totalDurations, 0.5),
      p95: percentile(totalDurations, 0.95)
    },
    timingPercentilesMs: Object.fromEntries(
      timingKeys.map(timingKey => {
        const values = samples
          .map(sample => sample.timingsMs[timingKey])
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        return [
          timingKey,
          {
            p50: percentile(values, 0.5),
            p95: percentile(values, 0.95),
            max: roundMetric(Math.max(...values))
          }
        ];
      })
    )
  };
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return roundMetric(sorted[index] ?? 0);
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeTimingRecord(input: unknown): Record<string, number> {
  if (!isRecord(input)) {
    return {};
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
}

function isPlatformConsoleEventName(value: unknown): value is PlatformConsoleLogEventName {
  return value === 'runtime.platform_console.fresh_aggregate' || value === 'runtime.platform_console.slow';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
