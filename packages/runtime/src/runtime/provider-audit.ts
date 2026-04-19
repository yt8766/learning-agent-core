export interface ProviderAuditAdapterConfig {
  provider: string;
  endpoint: string;
  apiKey: string;
  source: string;
}

export interface ProviderAuditDailyRecord {
  day: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  costCny: number;
  runs: number;
}

export interface ProviderAuditSyncResult {
  status: 'disabled' | 'configured' | 'synced' | 'error';
  provider: string;
  source: string;
  syncedAt?: string;
  message?: string;
  daily: ProviderAuditDailyRecord[];
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizeProviderAuditResponse(payload: unknown): ProviderAuditDailyRecord[] {
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? ((payload as { items?: unknown; records?: unknown; data?: unknown }).items ??
        (payload as { items?: unknown; records?: unknown; data?: unknown }).records ??
        (payload as { items?: unknown; records?: unknown; data?: unknown }).data)
      : [];

  if (!Array.isArray(items)) {
    return [];
  }

  const buckets = new Map<string, ProviderAuditDailyRecord>();
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as Record<string, unknown>;
    const day = String(candidate.day ?? candidate.date ?? candidate.billingDate ?? '').trim();
    if (!day) {
      continue;
    }

    const promptTokens =
      readFiniteNumber(candidate.promptTokens ?? candidate.prompt_tokens ?? candidate.input_tokens) ?? 0;
    const completionTokens =
      readFiniteNumber(candidate.completionTokens ?? candidate.completion_tokens ?? candidate.output_tokens) ?? 0;
    const totalTokens =
      readFiniteNumber(candidate.totalTokens ?? candidate.total_tokens) ?? promptTokens + completionTokens;
    const costUsd = readFiniteNumber(candidate.costUsd ?? candidate.cost_usd ?? candidate.total_cost_usd) ?? 0;
    const costCny =
      readFiniteNumber(candidate.costCny ?? candidate.cost_cny ?? candidate.total_cost_cny ?? candidate.amount) ??
      roundCurrency(costUsd * 7.2);
    const runs = readFiniteNumber(candidate.runs ?? candidate.requestCount ?? candidate.count) ?? 1;

    const bucket = buckets.get(day) ?? {
      day,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      costCny: 0,
      runs: 0
    };
    bucket.promptTokens += promptTokens;
    bucket.completionTokens += completionTokens;
    bucket.totalTokens += totalTokens;
    bucket.costUsd += costUsd;
    bucket.costCny += costCny;
    bucket.runs += runs;
    buckets.set(day, bucket);
  }

  return Array.from(buckets.values())
    .sort((left, right) => left.day.localeCompare(right.day))
    .map(item => ({
      ...item,
      costUsd: roundCurrency(item.costUsd),
      costCny: roundCurrency(item.costCny)
    }));
}

export async function fetchProviderUsageAuditFromAdapter(
  adapter: ProviderAuditAdapterConfig,
  days: number
): Promise<ProviderAuditSyncResult> {
  try {
    const url = new URL(adapter.endpoint);
    url.searchParams.set('days', String(Math.max(1, days)));
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        ...(adapter.apiKey ? { Authorization: `Bearer ${adapter.apiKey}` } : {})
      }
    });

    if (!response.ok) {
      return {
        status: 'error',
        provider: adapter.provider,
        source: adapter.source,
        message: `provider audit request failed: ${response.status}`,
        daily: []
      };
    }

    const payload = (await response.json()) as unknown;
    const daily = normalizeProviderAuditResponse(payload).slice(-Math.max(1, days));
    return {
      status: daily.length > 0 ? 'synced' : 'configured',
      provider: adapter.provider,
      source: adapter.source,
      syncedAt: new Date().toISOString(),
      message: daily.length > 0 ? undefined : 'provider audit endpoint 已配置，但当前未返回可用记录',
      daily
    };
  } catch (error) {
    return {
      status: 'error',
      provider: adapter.provider,
      source: adapter.source,
      message: error instanceof Error ? error.message : 'unknown provider audit error',
      daily: []
    };
  }
}

export async function fetchProviderUsageAudit(
  adapters: ProviderAuditAdapterConfig[],
  primaryProvider: string,
  days: number
): Promise<ProviderAuditSyncResult> {
  if (adapters.length === 0) {
    return {
      status: 'disabled',
      provider: primaryProvider,
      source: 'unconfigured',
      message: '未配置 provider usage audit adapter',
      daily: []
    };
  }

  const prioritizedAdapters = adapters.slice().sort((left, right) => {
    const leftScore = left.provider === primaryProvider ? 0 : 1;
    const rightScore = right.provider === primaryProvider ? 0 : 1;
    return leftScore - rightScore;
  });

  let lastFailure: ProviderAuditSyncResult | undefined;
  for (const adapter of prioritizedAdapters) {
    const result = await fetchProviderUsageAuditFromAdapter(adapter, days);
    if (result.status === 'synced' || result.status === 'configured') {
      return result;
    }
    lastFailure = result;
  }

  return (
    lastFailure ?? {
      status: 'error',
      provider: primaryProvider,
      source: 'unconfigured',
      message: 'provider audit adapter 执行失败',
      daily: []
    }
  );
}

export function summarizeProviderBilling(records: ProviderAuditDailyRecord[]) {
  return {
    promptTokens: records.reduce((sum, item) => sum + item.promptTokens, 0),
    completionTokens: records.reduce((sum, item) => sum + item.completionTokens, 0),
    totalTokens: records.reduce((sum, item) => sum + item.totalTokens, 0),
    costUsd: roundCurrency(records.reduce((sum, item) => sum + item.costUsd, 0)),
    costCny: roundCurrency(records.reduce((sum, item) => sum + item.costCny, 0)),
    runs: records.reduce((sum, item) => sum + item.runs, 0)
  };
}
