import { createHash } from 'node:crypto';
import {
  GatewayApiKeySchema,
  GatewayAuthFileSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayRequestLogEntrySchema,
  type GatewayApiKey,
  type GatewayAuthFile,
  type GatewayMigrationResourceKind,
  type GatewayMigrationResourcePreview,
  type GatewayProviderSpecificConfigRecord,
  type GatewayRequestLogEntry
} from '@agent/core';

export function conflictResource(
  kind: GatewayMigrationResourceKind,
  sourceId: string,
  targetId: string,
  summary: string
): GatewayMigrationResourcePreview {
  return { kind, sourceId, targetId, action: 'conflict', safe: false, summary };
}

export function hashImportedApiKey(apiKey: GatewayApiKey): string {
  return createHash('sha256').update(`cli-proxy-import:${apiKey.id}:${apiKey.prefix}`).digest('hex');
}

export function normalizeProviderConfigForImport(value: unknown): GatewayProviderSpecificConfigRecord {
  const record = asRecord(value);
  const id = stringField(record, 'id', 'providerId') ?? String(record.providerType ?? 'provider');
  return GatewayProviderSpecificConfigRecordSchema.parse({
    providerType: record.providerType,
    id,
    displayName: stringField(record, 'displayName', 'name') ?? id,
    enabled: booleanField(record, 'enabled') ?? true,
    baseUrl: stringField(record, 'baseUrl', 'base_url'),
    priority: numberField(record, 'priority') ?? undefined,
    prefix: stringField(record, 'prefix') ?? undefined,
    proxyUrl: stringField(record, 'proxyUrl', 'proxy_url'),
    headers: record.headers === undefined ? undefined : recordOf(record.headers),
    models: normalizeModelList(record.models, id),
    excludedModels: arrayOfStrings(record.excludedModels) ?? [],
    credentials: Array.isArray(record.credentials) ? record.credentials : [],
    cloakPolicy: record.cloakPolicy === undefined ? undefined : recordOf(record.cloakPolicy),
    testModel: stringField(record, 'testModel') ?? undefined,
    authIndex: stringField(record, 'authIndex') ?? undefined,
    rawSource: stringField(record, 'rawSource') ?? 'adapter'
  });
}

export function normalizeAuthFileForImport(value: unknown): GatewayAuthFile {
  const parsed = GatewayAuthFileSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const record = asRecord(value);
  const fileName = stringField(record, 'fileName', 'name') ?? 'auth.json';
  const providerKind = stringField(record, 'providerKind', 'providerId') ?? 'custom';
  return GatewayAuthFileSchema.parse({
    id: stringField(record, 'id') ?? fileName,
    providerId: stringField(record, 'providerId') ?? providerKind,
    providerKind,
    fileName,
    path: stringField(record, 'path') ?? fileName,
    status: stringField(record, 'status') ?? 'valid',
    accountEmail: stringField(record, 'accountEmail'),
    projectId: stringField(record, 'projectId'),
    authIndex: stringField(record, 'authIndex', 'auth_index'),
    disabled: booleanField(record, 'disabled') ?? undefined,
    failedCount: numberField(record, 'failedCount', 'failed', 'failure') ?? undefined,
    modelCount: numberField(record, 'modelCount') ?? 0,
    note: stringField(record, 'note'),
    prefix: stringField(record, 'prefix'),
    priority: numberField(record, 'priority') ?? undefined,
    proxyUrl: stringField(record, 'proxyUrl', 'proxy_url', 'proxy-url'),
    runtimeOnly: booleanField(record, 'runtimeOnly', 'runtime_only') ?? undefined,
    sizeBytes: numberField(record, 'sizeBytes', 'size_bytes', 'size') ?? undefined,
    statusMessage: stringField(record, 'statusMessage', 'status_message', 'message', 'error') ?? undefined,
    successCount: numberField(record, 'successCount', 'success') ?? undefined,
    updatedAt: stringField(record, 'updatedAt') ?? new Date(0).toISOString(),
    metadata: record.metadata === undefined ? {} : recordOf(record.metadata)
  });
}

export function normalizeApiKeyForImport(value: unknown, index: number): GatewayApiKey {
  const parsed = GatewayApiKeySchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const record = asRecord(value);
  const lastUsedAt = stringField(record, 'lastUsedAt', 'last_used_at');
  return GatewayApiKeySchema.parse({
    id: stringField(record, 'id') ?? `proxy-key-${index}`,
    name: stringField(record, 'name') ?? `Proxy key ${index + 1}`,
    prefix: stringField(record, 'prefix', 'masked', 'maskedApiKey', 'masked_api_key') ?? '***',
    status: booleanField(record, 'disabled') ? 'disabled' : (stringField(record, 'status') ?? 'active'),
    scopes: arrayOfStrings(record.scopes) ?? ['proxy:invoke'],
    createdAt: stringField(record, 'createdAt', 'created_at') ?? new Date(0).toISOString(),
    lastUsedAt,
    expiresAt: stringField(record, 'expiresAt', 'expires_at'),
    usage: {
      requestCount: numberField(recordOf(record.usage), 'requestCount', 'requests') ?? 0,
      lastRequestAt: stringField(recordOf(record.usage), 'lastRequestAt', 'last_request_at') ?? lastUsedAt
    }
  });
}

export function normalizeRequestLogForImport(value: unknown): GatewayRequestLogEntry {
  const parsed = GatewayRequestLogEntrySchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const record = asRecord(value);
  return GatewayRequestLogEntrySchema.parse({
    id: stringField(record, 'id') ?? 'request-log',
    occurredAt: stringField(record, 'occurredAt', 'timestamp') ?? new Date(0).toISOString(),
    method: stringField(record, 'method') ?? 'GET',
    path: stringField(record, 'path', 'url') ?? '/',
    statusCode: numberField(record, 'statusCode', 'status') ?? 200,
    durationMs: numberField(record, 'durationMs', 'duration_ms') ?? 0,
    managementTraffic: booleanField(record, 'managementTraffic', 'management_traffic') ?? false,
    providerId: stringField(record, 'providerId', 'provider_id'),
    apiKeyPrefix: stringField(record, 'apiKeyPrefix', 'api_key_prefix'),
    message: stringField(record, 'message') ?? undefined
  });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'import failed';
}

function normalizeModelList(value: unknown, fallbackName: string): Array<{ name: string; alias?: string }> {
  if (!Array.isArray(value) || value.length === 0) return [{ name: fallbackName }];
  return value.map(item => {
    if (typeof item === 'string') return { name: item };
    const record = asRecord(item);
    return {
      name: stringField(record, 'name', 'model', 'id') ?? fallbackName,
      alias: stringField(record, 'alias') ?? undefined
    };
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function recordOf(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) if (typeof record[key] === 'string') return record[key];
  return null;
}

function numberField(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) if (typeof record[key] === 'number' && Number.isFinite(record[key])) return record[key];
  return null;
}

function booleanField(record: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) if (typeof record[key] === 'boolean') return record[key];
  return null;
}

function arrayOfStrings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;
}
