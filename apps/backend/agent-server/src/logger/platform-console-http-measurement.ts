export interface PlatformConsoleHttpMeasurementSample {
  status: number;
  requestDurationMs: number;
  serverTotalDurationMs?: number;
  cacheStatus?: string;
}

export interface PlatformConsoleHttpMeasurementReport {
  url: string;
  sampleCount: number;
  warmupCount: number;
  requestDurationMs: PlatformConsoleDurationSummary;
  serverTotalDurationMs: PlatformConsoleDurationSummary | null;
  cacheStatusCounts: Record<string, number>;
  budgetsMs: {
    requestP95: number;
    serverTotalP95: number;
  };
  failedBudgets: string[];
  samples: PlatformConsoleHttpMeasurementSample[];
}

export interface PlatformConsoleDurationSummary {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
}

export interface PlatformConsoleHttpMeasurementComparison {
  status: 'improved' | 'regressed' | 'unchanged';
  requestP95DeltaMs: number;
  serverTotalP95DeltaMs: number | null;
  cacheHitRateDelta: number | null;
  highlights: string[];
  baseline: PlatformConsoleHttpMeasurementReport;
  current: PlatformConsoleHttpMeasurementReport;
}

export interface PlatformConsoleEndpointVariantMeasurement {
  baseline: {
    label: string;
    report: PlatformConsoleHttpMeasurementReport;
  };
  current: {
    label: string;
    report: PlatformConsoleHttpMeasurementReport;
  };
  comparison: PlatformConsoleHttpMeasurementComparison;
}

interface MeasurePlatformConsoleEndpointOptions {
  url: string;
  iterations?: number;
  warmup?: number;
  budgetsMs?: {
    requestP95?: number;
    serverTotalP95?: number;
  };
  fetcher?: typeof fetch;
  now?: () => number;
}

interface MeasurePlatformConsoleEndpointVariantsOptions extends MeasurePlatformConsoleEndpointOptions {
  baselineLabel: string;
  baselineUrl: string;
  currentLabel: string;
  currentUrl: string;
}

const DEFAULT_BUDGETS_MS = {
  requestP95: 1000,
  serverTotalP95: 1000
} as const;

export async function measurePlatformConsoleEndpoint(
  options: MeasurePlatformConsoleEndpointOptions
): Promise<PlatformConsoleHttpMeasurementReport> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => Date.now());
  const iterations = Math.max(1, options.iterations ?? 5);
  const warmup = Math.max(0, options.warmup ?? 1);
  const budgetsMs = {
    requestP95: options.budgetsMs?.requestP95 ?? DEFAULT_BUDGETS_MS.requestP95,
    serverTotalP95: options.budgetsMs?.serverTotalP95 ?? DEFAULT_BUDGETS_MS.serverTotalP95
  };

  for (let index = 0; index < warmup; index += 1) {
    await fetchPlatformConsoleSample(fetcher, now, options.url);
  }

  const samples: PlatformConsoleHttpMeasurementSample[] = [];
  for (let index = 0; index < iterations; index += 1) {
    samples.push(await fetchPlatformConsoleSample(fetcher, now, options.url));
  }

  const requestDurationMs = summarizeDurations(samples.map(sample => sample.requestDurationMs));
  const serverDurations = samples
    .map(sample => sample.serverTotalDurationMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const serverTotalDurationMs = serverDurations.length ? summarizeDurations(serverDurations) : null;
  const cacheStatusCounts = samples.reduce<Record<string, number>>((current, sample) => {
    if (!sample.cacheStatus) {
      return current;
    }
    current[sample.cacheStatus] = (current[sample.cacheStatus] ?? 0) + 1;
    return current;
  }, {});

  const failedBudgets: string[] = [];
  if (requestDurationMs.p95 > budgetsMs.requestP95) {
    failedBudgets.push(`request p95 ${requestDurationMs.p95}ms exceeds ${budgetsMs.requestP95}ms budget`);
  }
  if (serverTotalDurationMs && serverTotalDurationMs.p95 > budgetsMs.serverTotalP95) {
    failedBudgets.push(`server total p95 ${serverTotalDurationMs.p95}ms exceeds ${budgetsMs.serverTotalP95}ms budget`);
  }

  return {
    url: options.url,
    sampleCount: samples.length,
    warmupCount: warmup,
    requestDurationMs,
    serverTotalDurationMs,
    cacheStatusCounts,
    budgetsMs,
    failedBudgets,
    samples
  };
}

export async function measurePlatformConsoleEndpointVariants(
  options: MeasurePlatformConsoleEndpointVariantsOptions
): Promise<PlatformConsoleEndpointVariantMeasurement> {
  const baselineReport = await measurePlatformConsoleEndpoint({
    url: options.baselineUrl,
    iterations: options.iterations,
    warmup: options.warmup,
    budgetsMs: options.budgetsMs,
    fetcher: options.fetcher,
    now: options.now
  });
  const currentReport = await measurePlatformConsoleEndpoint({
    url: options.currentUrl,
    iterations: options.iterations,
    warmup: options.warmup,
    budgetsMs: options.budgetsMs,
    fetcher: options.fetcher,
    now: options.now
  });

  return {
    baseline: {
      label: options.baselineLabel,
      report: baselineReport
    },
    current: {
      label: options.currentLabel,
      report: currentReport
    },
    comparison: comparePlatformConsoleHttpMeasurementReports(baselineReport, currentReport)
  };
}

export function formatPlatformConsoleHttpMeasurementReport(report: PlatformConsoleHttpMeasurementReport): string {
  const lines = [
    'Platform console HTTP benchmark',
    `url: ${report.url}`,
    `samples: ${report.sampleCount} (warmup ${report.warmupCount})`,
    `Budget status: ${report.failedBudgets.length ? 'failed' : 'passed'}`,
    `request duration: ${formatDurationSummary(report.requestDurationMs)}`
  ];

  if (report.serverTotalDurationMs) {
    lines.push(`server total: ${formatDurationSummary(report.serverTotalDurationMs)}`);
  } else {
    lines.push('server total: unavailable');
  }

  const cacheStatuses = Object.entries(report.cacheStatusCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}=${count}`);
  lines.push(`cache statuses: ${cacheStatuses.length ? cacheStatuses.join(', ') : 'none'}`);
  lines.push(
    `budgets: request p95 <= ${report.budgetsMs.requestP95}ms, server total p95 <= ${report.budgetsMs.serverTotalP95}ms`
  );
  if (report.failedBudgets.length) {
    lines.push(...report.failedBudgets.map(reason => `- ${reason}`));
  }

  return lines.join('\n');
}

export function comparePlatformConsoleHttpMeasurementReports(
  baseline: PlatformConsoleHttpMeasurementReport,
  current: PlatformConsoleHttpMeasurementReport
): PlatformConsoleHttpMeasurementComparison {
  const requestP95DeltaMs = roundMetric(current.requestDurationMs.p95 - baseline.requestDurationMs.p95);
  const serverTotalP95DeltaMs =
    baseline.serverTotalDurationMs && current.serverTotalDurationMs
      ? roundMetric(current.serverTotalDurationMs.p95 - baseline.serverTotalDurationMs.p95)
      : null;
  const baselineCacheHitRate = toCacheHitRate(baseline.cacheStatusCounts);
  const currentCacheHitRate = toCacheHitRate(current.cacheStatusCounts);
  const cacheHitRateDelta =
    baselineCacheHitRate !== null && currentCacheHitRate !== null
      ? roundMetric(currentCacheHitRate - baselineCacheHitRate)
      : null;

  const highlights: string[] = [];
  if (requestP95DeltaMs > 0) {
    highlights.push(`request p95 regressed by ${requestP95DeltaMs}ms`);
  } else if (requestP95DeltaMs < 0) {
    highlights.push(`request p95 improved by ${Math.abs(requestP95DeltaMs)}ms`);
  }
  if (typeof serverTotalP95DeltaMs === 'number' && serverTotalP95DeltaMs > 0) {
    highlights.push(`server total p95 regressed by ${serverTotalP95DeltaMs}ms`);
  } else if (typeof serverTotalP95DeltaMs === 'number' && serverTotalP95DeltaMs < 0) {
    highlights.push(`server total p95 improved by ${Math.abs(serverTotalP95DeltaMs)}ms`);
  }
  if (typeof cacheHitRateDelta === 'number' && cacheHitRateDelta < 0) {
    highlights.push(`cache hit rate dropped by ${Math.abs(cacheHitRateDelta * 100)}pp`);
  } else if (typeof cacheHitRateDelta === 'number' && cacheHitRateDelta > 0) {
    highlights.push(`cache hit rate improved by ${cacheHitRateDelta * 100}pp`);
  }

  return {
    status: classifyComparisonStatus(requestP95DeltaMs, serverTotalP95DeltaMs, cacheHitRateDelta),
    requestP95DeltaMs,
    serverTotalP95DeltaMs,
    cacheHitRateDelta,
    highlights,
    baseline,
    current
  };
}

export function formatPlatformConsoleHttpMeasurementComparison(
  comparison: PlatformConsoleHttpMeasurementComparison
): string {
  const lines = [
    'Platform console benchmark comparison',
    `Status: ${comparison.status}`,
    `request p95: baseline ${comparison.baseline.requestDurationMs.p95}ms -> current ${comparison.current.requestDurationMs.p95}ms`,
    `server total p95: ${formatComparisonDuration(comparison.baseline.serverTotalDurationMs, comparison.current.serverTotalDurationMs)}`,
    `cache hit rate: baseline ${formatCacheHitRate(toCacheHitRate(comparison.baseline.cacheStatusCounts))} -> current ${formatCacheHitRate(toCacheHitRate(comparison.current.cacheStatusCounts))}`
  ];

  if (comparison.highlights.length) {
    lines.push(...comparison.highlights.map(item => `- ${item}`));
  }

  return lines.join('\n');
}

export function formatPlatformConsoleEndpointVariantMeasurement(
  measurement: PlatformConsoleEndpointVariantMeasurement
): string {
  return [
    'Platform console variant benchmark',
    `baseline: ${measurement.baseline.label}`,
    formatPlatformConsoleHttpMeasurementReport(measurement.baseline.report),
    '',
    `current: ${measurement.current.label}`,
    formatPlatformConsoleHttpMeasurementReport(measurement.current.report),
    '',
    formatPlatformConsoleHttpMeasurementComparison(measurement.comparison)
  ].join('\n');
}

async function fetchPlatformConsoleSample(
  fetcher: typeof fetch,
  now: () => number,
  url: string
): Promise<PlatformConsoleHttpMeasurementSample> {
  const startedAt = now();
  const response = await fetcher(url);
  const completedAt = now();
  const requestDurationMs = roundMetric(completedAt - startedAt);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Platform console request failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    diagnostics?: {
      cacheStatus?: string;
      timingsMs?: {
        total?: number;
      };
    };
  };

  return {
    status: response.status,
    requestDurationMs,
    serverTotalDurationMs:
      typeof payload.diagnostics?.timingsMs?.total === 'number' ? payload.diagnostics.timingsMs.total : undefined,
    cacheStatus: typeof payload.diagnostics?.cacheStatus === 'string' ? payload.diagnostics.cacheStatus : undefined
  };
}

function summarizeDurations(values: number[]): PlatformConsoleDurationSummary {
  const sorted = [...values].sort((left, right) => left - right);
  const sum = sorted.reduce((current, value) => current + value, 0);
  return {
    min: roundMetric(sorted[0] ?? 0),
    max: roundMetric(sorted[sorted.length - 1] ?? 0),
    avg: roundMetric(sum / Math.max(1, sorted.length)),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95)
  };
}

function percentile(sortedValues: number[], ratio: number): number {
  if (!sortedValues.length) {
    return 0;
  }
  const index = Math.max(0, Math.ceil(sortedValues.length * ratio) - 1);
  return roundMetric(sortedValues[index] ?? 0);
}

function formatDurationSummary(summary: PlatformConsoleDurationSummary) {
  return `avg=${summary.avg}ms p50=${summary.p50}ms p95=${summary.p95}ms min=${summary.min}ms max=${summary.max}ms`;
}

function classifyComparisonStatus(
  requestP95DeltaMs: number,
  serverTotalP95DeltaMs: number | null,
  cacheHitRateDelta: number | null
): 'improved' | 'regressed' | 'unchanged' {
  if (requestP95DeltaMs > 0 || (typeof serverTotalP95DeltaMs === 'number' && serverTotalP95DeltaMs > 0)) {
    return 'regressed';
  }
  if (requestP95DeltaMs < 0 || (typeof serverTotalP95DeltaMs === 'number' && serverTotalP95DeltaMs < 0)) {
    return 'improved';
  }
  if (typeof cacheHitRateDelta === 'number' && cacheHitRateDelta !== 0) {
    return cacheHitRateDelta > 0 ? 'improved' : 'regressed';
  }
  return 'unchanged';
}

function toCacheHitRate(cacheStatusCounts: Record<string, number>): number | null {
  const total = Object.values(cacheStatusCounts).reduce((current, value) => current + value, 0);
  if (total === 0) {
    return null;
  }
  return roundMetric((cacheStatusCounts.hit ?? 0) / total);
}

function formatCacheHitRate(value: number | null) {
  if (typeof value !== 'number') {
    return 'n/a';
  }
  return `${roundMetric(value * 100)}%`;
}

function formatComparisonDuration(
  baseline: PlatformConsoleDurationSummary | null,
  current: PlatformConsoleDurationSummary | null
) {
  if (!baseline || !current) {
    return 'n/a';
  }
  return `baseline ${baseline.p95}ms -> current ${current.p95}ms`;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}
