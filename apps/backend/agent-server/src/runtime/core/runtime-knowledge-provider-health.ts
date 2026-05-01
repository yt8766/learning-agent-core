import type { VectorSearchProvider } from '@agent/knowledge';

export interface RuntimeKnowledgeHealthCheckProvider {
  healthCheck?(): Promise<{
    status: 'healthy' | 'degraded';
    message?: string;
  }>;
}

export interface RuntimeKnowledgeProviderHealth {
  status: 'healthy' | 'degraded' | 'unknown';
  checkedAt: string;
  latencyMs?: number;
  message?: string;
  consecutiveFailures?: number;
}

export interface RuntimeKnowledgeProviderHealthConfig {
  ttlMs?: number;
  timeoutMs?: number;
  degradedAfterConsecutiveFailures?: number;
}

export function createVectorProviderHealthChecker(
  provider: VectorSearchProvider,
  config?: RuntimeKnowledgeProviderHealthConfig
) {
  return createProviderHealthChecker(provider, 'Vector', config);
}

export function createKeywordProviderHealthChecker(
  provider: RuntimeKnowledgeHealthCheckProvider,
  config?: RuntimeKnowledgeProviderHealthConfig
) {
  return createProviderHealthChecker(provider, 'Keyword', config);
}

function createProviderHealthChecker(
  provider: RuntimeKnowledgeHealthCheckProvider,
  providerLabel: 'Keyword' | 'Vector',
  config?: RuntimeKnowledgeProviderHealthConfig
) {
  const ttlMs = Math.max(0, config?.ttlMs ?? 5000);
  const timeoutMs = Math.max(1, config?.timeoutMs ?? 2000);
  const degradedAfterConsecutiveFailures = Math.max(1, config?.degradedAfterConsecutiveFailures ?? 1);
  let cached: { cachedAt: number; health: RuntimeKnowledgeProviderHealth } | undefined;
  let consecutiveFailures = 0;

  return async () => {
    const now = Date.now();
    if (cached && ttlMs > 0 && now - cached.cachedAt < ttlMs) {
      return cached.health;
    }

    const health = await checkProviderHealth(provider, providerLabel, timeoutMs, consecutiveFailures);
    consecutiveFailures = health.status === 'degraded' ? consecutiveFailures + 1 : 0;
    const healthWithFailures = {
      ...health,
      status:
        health.status === 'degraded' && consecutiveFailures < degradedAfterConsecutiveFailures
          ? ('unknown' as const)
          : health.status,
      consecutiveFailures
    };
    cached = {
      cachedAt: now,
      health: healthWithFailures
    };
    return healthWithFailures;
  };
}

async function checkProviderHealth(
  provider: RuntimeKnowledgeHealthCheckProvider,
  providerLabel: 'Keyword' | 'Vector',
  timeoutMs: number,
  currentConsecutiveFailures: number
): Promise<RuntimeKnowledgeProviderHealth> {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();

  if (!provider.healthCheck) {
    return {
      status: 'unknown',
      checkedAt,
      message: `${providerLabel} provider does not expose a health check.`,
      consecutiveFailures: currentConsecutiveFailures
    };
  }

  try {
    const result = await withTimeout(provider.healthCheck(), providerLabel, timeoutMs);
    return {
      status: result.status,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      message: result.message
    };
  } catch (error) {
    return {
      status: 'degraded',
      checkedAt,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function withTimeout<T>(promise: Promise<T>, providerLabel: 'Keyword' | 'Vector', timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${providerLabel} provider health check timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}
