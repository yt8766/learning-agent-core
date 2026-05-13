import type {
  GatewayApiKey,
  GatewayAuthFile,
  GatewayClientApiKey,
  GatewayCredentialFile,
  GatewayLogEntry,
  GatewayProviderCredentialSet,
  GatewayProviderSpecificConfigRecord,
  GatewayQuota,
  GatewayQuotaDetail,
  GatewayRawConfigResponse,
  GatewayUpdateConfigRequest
} from '@agent/core';

export function mapProviderConfigToLocalProvider(
  config: GatewayProviderSpecificConfigRecord
): GatewayProviderCredentialSet {
  return {
    id: config.id,
    provider: config.displayName,
    modelFamilies: config.models.map(model => model.alias ?? model.name),
    status: config.enabled ? 'healthy' : 'disabled',
    priority: config.priority ?? 50,
    baseUrl: config.baseUrl ?? undefined,
    timeoutMs: 60000
  };
}

export function mapAuthFileToCredentialFile(file: GatewayAuthFile): GatewayCredentialFile {
  return {
    id: file.id,
    provider: file.providerKind,
    path: file.path,
    status: file.status === 'valid' ? 'valid' : 'missing',
    lastCheckedAt: file.updatedAt
  };
}

export function mapQuotaDetailToLocalQuota(quota: GatewayQuotaDetail): GatewayQuota {
  return {
    id: quota.id,
    provider: quota.providerId,
    scope: quota.window === 'unknown' ? quota.scope : `${quota.scope}:${quota.window}`,
    usedTokens: quota.used,
    limitTokens: quota.limit,
    resetAt: quota.resetAt ?? quota.refreshedAt,
    status: quota.status
  };
}

export function mapRequestLogToLocalLog(log: {
  id: string;
  occurredAt: string;
  statusCode: number;
  providerId?: string | null;
  message?: string;
  path: string;
}): GatewayLogEntry {
  return {
    id: log.id,
    occurredAt: log.occurredAt,
    level: log.statusCode >= 500 ? 'error' : log.statusCode >= 400 ? 'warn' : 'info',
    stage: 'proxy',
    provider: log.providerId ?? 'cli-proxy',
    message: log.message ?? log.path,
    inputTokens: 0,
    outputTokens: 0
  };
}

export function mapApiKeyToImportedClientApiKey(apiKey: GatewayApiKey, importedAt: string): GatewayClientApiKey {
  return {
    id: apiKey.id,
    clientId: 'cli-proxy-import',
    name: apiKey.name,
    prefix: apiKey.prefix,
    status: 'disabled',
    scopes: normalizeClientScopes(apiKey.scopes),
    createdAt: apiKey.createdAt,
    expiresAt: apiKey.expiresAt,
    lastUsedAt: apiKey.lastUsedAt ?? importedAt
  };
}

function normalizeClientScopes(scopes: string[]): Array<'chat.completions' | 'models.read'> {
  const allowed = scopes.filter(
    (scope): scope is 'chat.completions' | 'models.read' => scope === 'chat.completions' || scope === 'models.read'
  );
  return allowed.length > 0 ? allowed : ['models.read', 'chat.completions'];
}

export function parseRawConfigPatch(rawConfig: GatewayRawConfigResponse): GatewayUpdateConfigRequest | null {
  const retryLimit = matchInteger(rawConfig.content, /(?:request-retry|retryLimit)\s*:\s*(\d+)/u);
  const auditEnabled = matchBoolean(rawConfig.content, /(?:audit|auditEnabled)\s*:\s*(true|false)/iu);
  const circuitBreakerEnabled = matchBoolean(
    rawConfig.content,
    /(?:circuit-breaker-enabled|circuitBreakerEnabled)\s*:\s*(true|false)/iu
  );
  const patch: GatewayUpdateConfigRequest = {};
  if (retryLimit !== null) patch.retryLimit = retryLimit;
  if (auditEnabled !== null) patch.auditEnabled = auditEnabled;
  if (circuitBreakerEnabled !== null) patch.circuitBreakerEnabled = circuitBreakerEnabled;
  return Object.keys(patch).length > 0 ? patch : null;
}

function matchInteger(content: string, pattern: RegExp): number | null {
  const match = pattern.exec(content);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function matchBoolean(content: string, pattern: RegExp): boolean | null {
  const match = pattern.exec(content);
  if (!match?.[1]) return null;
  return match[1].toLowerCase() === 'true';
}
