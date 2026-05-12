import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  GatewayClient,
  GatewayClientRequestLog,
  GatewayUsageAnalyticsModelStat,
  GatewayUsageAnalyticsProviderStat,
  GatewayUsageAnalyticsQuery,
  GatewayUsageAnalyticsRequestLog,
  GatewayUsageAnalyticsResponse,
  GatewayUsageAnalyticsSummary,
  GatewayUsageAnalyticsTrendPoint
} from '@agent/core';
import type { AgentGatewayClientRepository } from '../clients/agent-gateway-client.repository';
import {
  AGENT_GATEWAY_CLIENT_CLOCK,
  AGENT_GATEWAY_CLIENT_REPOSITORY
} from '../clients/agent-gateway-client.repository';

type DateFactory = () => Date;

interface AnalyticsRow {
  client: GatewayClient;
  log: GatewayClientRequestLog;
  projected: GatewayUsageAnalyticsRequestLog;
}

@Injectable()
export class AgentGatewayUsageAnalyticsService {
  constructor(
    @Inject(AGENT_GATEWAY_CLIENT_REPOSITORY)
    private readonly repository: AgentGatewayClientRepository,
    @Optional()
    @Inject(AGENT_GATEWAY_CLIENT_CLOCK)
    private readonly now: DateFactory = () => new Date()
  ) {}

  async summary(query: GatewayUsageAnalyticsQuery): Promise<GatewayUsageAnalyticsResponse> {
    const observedAt = this.now();
    const range = resolveRange(query.range, observedAt);
    const rows = await this.collectRows();
    const filteredRows = rows.filter(row => matchesQuery(row, query, range.fromTime, range.toTime));
    const requestLogs = filteredRows.slice(0, query.limit).map(row => row.projected);
    return {
      observedAt: observedAt.toISOString(),
      range: {
        preset: query.range,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        bucketMinutes: range.bucketMinutes
      },
      activeTab: 'requestLogs',
      summary: summarize(requestLogs),
      trend: buildTrend(filteredRows, range),
      requestLogs: {
        items: requestLogs,
        total: filteredRows.length,
        nextCursor: filteredRows.length > requestLogs.length ? (requestLogs.at(-1)?.id ?? null) : null
      },
      providerStats: buildProviderStats(filteredRows),
      modelStats: buildModelStats(filteredRows),
      filters: buildFilters(rows)
    };
  }

  private async collectRows(): Promise<AnalyticsRow[]> {
    const clients = await this.repository.listClients();
    const rows: AnalyticsRow[] = [];
    for (const client of clients) {
      const logs = await this.repository.listRequestLogs(client.id, 500);
      for (const log of logs) {
        rows.push({
          client,
          log,
          projected: projectLog(client, log)
        });
      }
    }
    return rows.sort((left, right) => Date.parse(right.log.occurredAt) - Date.parse(left.log.occurredAt));
  }
}

function projectLog(client: GatewayClient, log: GatewayClientRequestLog): GatewayUsageAnalyticsRequestLog {
  const totalTokens = log.inputTokens + log.outputTokens;
  const providerId = log.providerId ?? 'unknown';
  return {
    id: log.id,
    occurredAt: log.occurredAt,
    providerId: log.providerId,
    providerName: providerDisplayName(providerId),
    model: log.model,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
    totalTokens,
    cacheCreateTokens: 0,
    cacheHitTokens: 0,
    estimatedCostUsd: 0,
    latencyMs: log.latencyMs,
    statusCode: log.statusCode,
    source: providerId,
    applicationId: client.id
  };
}

function matchesQuery(row: AnalyticsRow, query: GatewayUsageAnalyticsQuery, fromTime: number, toTime: number): boolean {
  const occurredAt = Date.parse(row.log.occurredAt);
  if (!Number.isFinite(occurredAt) || occurredAt < fromTime || occurredAt > toTime) return false;
  if (query.providerId && row.projected.providerId !== query.providerId) return false;
  if (query.applicationId && row.client.id !== query.applicationId) return false;
  if (query.status === 'success' && !isSuccess(row.log.statusCode)) return false;
  if (query.status === 'error' && isSuccess(row.log.statusCode)) return false;
  if (query.providerSearch && !contains(row.projected.providerName, query.providerSearch)) return false;
  if (query.modelSearch && !contains(row.log.model ?? '', query.modelSearch)) return false;
  return true;
}

function summarize(items: GatewayUsageAnalyticsRequestLog[]): GatewayUsageAnalyticsSummary {
  return items.reduce(
    (summary, item) => ({
      requestCount: summary.requestCount + 1,
      estimatedCostUsd: summary.estimatedCostUsd + item.estimatedCostUsd,
      totalTokens: summary.totalTokens + item.totalTokens,
      inputTokens: summary.inputTokens + item.inputTokens,
      outputTokens: summary.outputTokens + item.outputTokens,
      cacheCreateTokens: summary.cacheCreateTokens + item.cacheCreateTokens,
      cacheHitTokens: summary.cacheHitTokens + item.cacheHitTokens
    }),
    emptySummary()
  );
}

function buildTrend(rows: AnalyticsRow[], range: ResolvedRange): GatewayUsageAnalyticsTrendPoint[] {
  const bucketMs = range.bucketMinutes * 60_000;
  const buckets = new Map<number, GatewayUsageAnalyticsRequestLog[]>();
  for (let time = range.fromTime; time <= range.toTime; time += bucketMs) {
    buckets.set(time, []);
  }
  for (const row of rows) {
    const occurredAt = Date.parse(row.log.occurredAt);
    const bucketStart = range.fromTime + Math.floor((occurredAt - range.fromTime) / bucketMs) * bucketMs;
    const bucket = buckets.get(bucketStart);
    if (bucket) bucket.push(row.projected);
  }
  return [...buckets.entries()].map(([bucketStart, items]) => ({
    bucketStart: new Date(bucketStart).toISOString(),
    ...summarize(items)
  }));
}

function buildProviderStats(rows: AnalyticsRow[]): GatewayUsageAnalyticsProviderStat[] {
  return [...groupBy(rows, row => row.projected.providerId ?? 'unknown').entries()]
    .map(([providerId, group]) => {
      const logs = group.map(row => row.projected);
      const summary = summarize(logs);
      return {
        providerId,
        providerName: providerDisplayName(providerId),
        requestCount: summary.requestCount,
        totalTokens: summary.totalTokens,
        inputTokens: summary.inputTokens,
        outputTokens: summary.outputTokens,
        estimatedCostUsd: summary.estimatedCostUsd,
        successRate: safeRatio(logs.filter(item => isSuccess(item.statusCode)).length, logs.length),
        averageLatencyMs: average(logs.map(item => item.latencyMs))
      };
    })
    .sort((left, right) => right.requestCount - left.requestCount);
}

function buildModelStats(rows: AnalyticsRow[]): GatewayUsageAnalyticsModelStat[] {
  return [...groupBy(rows, row => row.projected.model ?? 'unknown').entries()]
    .map(([model, group]) => {
      const logs = group.map(row => row.projected);
      const summary = summarize(logs);
      return {
        model,
        providerId: group[0]?.projected.providerId ?? null,
        requestCount: summary.requestCount,
        totalTokens: summary.totalTokens,
        inputTokens: summary.inputTokens,
        outputTokens: summary.outputTokens,
        estimatedCostUsd: summary.estimatedCostUsd,
        averageCostUsd: safeRatio(summary.estimatedCostUsd, summary.requestCount)
      };
    })
    .sort((left, right) => right.requestCount - left.requestCount);
}

function buildFilters(rows: AnalyticsRow[]): GatewayUsageAnalyticsResponse['filters'] {
  return {
    providers: filterOptions(
      rows,
      row => row.projected.providerId ?? 'unknown',
      row => row.projected.providerName
    ),
    models: filterOptions(
      rows,
      row => row.projected.model ?? 'unknown',
      row => row.projected.model ?? 'unknown'
    ),
    applications: filterOptions(
      rows,
      row => row.client.id,
      row => row.client.name
    )
  };
}

function filterOptions(
  rows: AnalyticsRow[],
  idOf: (row: AnalyticsRow) => string,
  labelOf: (row: AnalyticsRow) => string
) {
  return [...groupBy(rows, idOf).entries()]
    .map(([id, group]) => ({ id, label: labelOf(group[0]!), count: group.length }))
    .sort((left, right) => right.count - left.count);
}

interface ResolvedRange {
  from: Date;
  to: Date;
  fromTime: number;
  toTime: number;
  bucketMinutes: number;
}

function resolveRange(preset: GatewayUsageAnalyticsQuery['range'], now: Date): ResolvedRange {
  const to = new Date(now);
  let from: Date;
  let bucketMinutes: number;
  if (preset === '7d') {
    from = new Date(to.getTime() - 7 * 24 * 60 * 60_000);
    bucketMinutes = 24 * 60;
  } else if (preset === '30d') {
    from = new Date(to.getTime() - 30 * 24 * 60 * 60_000);
    bucketMinutes = 24 * 60;
  } else if (preset === '24h') {
    from = new Date(to.getTime() - 24 * 60 * 60_000);
    bucketMinutes = 60;
  } else {
    from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 0, 0, 0, 0));
    bucketMinutes = 60;
  }
  return { from, to, fromTime: from.getTime(), toTime: to.getTime(), bucketMinutes };
}

function providerDisplayName(providerId: string): string {
  if (providerId === 'codex_session') return 'Codex (Session)';
  if (providerId === 'claude_session') return 'Claude (Session)';
  if (providerId === 'gemini_cli') return 'Gemini CLI';
  return providerId
    .split(/[-_]/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function emptySummary(): GatewayUsageAnalyticsSummary {
  return {
    requestCount: 0,
    estimatedCostUsd: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreateTokens: 0,
    cacheHitTokens: 0
  };
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function isSuccess(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 400;
}

function contains(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
