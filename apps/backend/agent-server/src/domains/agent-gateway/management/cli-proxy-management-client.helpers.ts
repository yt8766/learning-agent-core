import { HttpException, UnauthorizedException } from '@nestjs/common';
import type {
  GatewayApiKeyListResponse,
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayConnectionStatusResponse,
  GatewayOAuthModelAliasListResponse,
  GatewayOAuthStatusResponse,
  GatewayProviderKind,
  GatewayProviderSpecificConfigListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayRequestLogListResponse,
  GatewaySystemModelsResponse,
  GatewaySystemVersionResponse
} from '@agent/core';

export type RecordBody = Record<string, unknown>;

export function normalizeBaseUrl(apiBase: string): string {
  const trimmed = apiBase.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/v0/management') ? trimmed : `${trimmed}/v0/management`;
}

export async function throwProxyError(response: Response): Promise<never> {
  const body = asRecord(await response.json().catch(() => ({})));
  const message =
    stringField(body, 'message') ??
    stringField(recordOf(body.error), 'message') ??
    `CLI Proxy management request failed with ${response.status}`;
  if (response.status === 401) throw new UnauthorizedException({ code: 'GATEWAY_UNAUTHENTICATED', message });
  throw new HttpException({ code: 'GATEWAY_UPSTREAM_FAILED', message }, response.status);
}

export function providerEndpoint(providerType: GatewayProviderSpecificConfigRecord['providerType']): string {
  return providerType === 'openaiCompatible' ? '/openai-compatibility' : `/${providerType}-api-key`;
}

export function createProviderConfigList(): GatewayProviderSpecificConfigListResponse {
  const providers: GatewayProviderSpecificConfigRecord['providerType'][] = [
    'gemini',
    'codex',
    'claude',
    'vertex',
    'openaiCompatible',
    'ampcode'
  ];
  return {
    items: providers.map(providerType => ({
      providerType,
      id: providerType,
      displayName: providerType,
      enabled: true,
      baseUrl: null,
      models: [],
      excludedModels: [],
      credentials: [],
      rawSource: 'adapter'
    }))
  };
}

export function mapApiKeys(body: RecordBody): GatewayApiKeyListResponse {
  return {
    items: arrayBody(body, 'items', 'keys', 'apiKeys', 'api-keys').map((item, index) => {
      const record = asRecord(item);
      const rawKey = typeof item === 'string' ? item : (stringField(record, 'key', 'value', 'apiKey', 'api_key') ?? '');
      const lastUsedAt = stringField(recordOf(record.usage), 'lastRequestAt', 'last_request_at');
      return {
        id: stringField(record, 'id') ?? `proxy-key-${index}`,
        name: stringField(record, 'name') ?? `Proxy key ${index + 1}`,
        prefix: stringField(record, 'prefix', 'masked') ?? maskSecret(rawKey ?? ''),
        status: booleanField(record, 'disabled') ? 'disabled' : 'active',
        scopes: arrayOfStrings(record.scopes) ?? ['proxy:invoke'],
        createdAt: stringField(record, 'createdAt', 'created_at') ?? new Date(0).toISOString(),
        lastUsedAt,
        expiresAt: stringField(record, 'expiresAt') ?? null,
        usage: {
          requestCount: numberField(recordOf(record.usage), 'requestCount', 'requests') ?? 0,
          lastRequestAt: lastUsedAt
        }
      };
    })
  };
}

export function mapAuthFile(value: unknown): GatewayAuthFile {
  const record = asRecord(value);
  const fileName = stringField(record, 'fileName', 'name') ?? 'auth.json';
  const providerKind = normalizeProviderKind(stringField(record, 'providerKind') ?? fileName);
  const disabled = booleanField(record, 'disabled');
  const unavailable = booleanField(record, 'unavailable');
  const rawStatus = stringField(record, 'status');
  const status = normalizeAuthFileStatus(rawStatus, unavailable);
  const headers = record.headers === undefined ? undefined : normalizeStringRecord(recordOf(record.headers));
  return {
    id: stringField(record, 'id') ?? fileName,
    providerId: stringField(record, 'providerId', 'provider', 'type') ?? providerKind,
    providerKind,
    fileName,
    path: stringField(record, 'path') ?? fileName,
    status,
    accountEmail: stringField(record, 'accountEmail', 'account_email', 'email'),
    projectId: stringField(record, 'projectId', 'project_id'),
    authIndex: stringField(record, 'authIndex', 'auth_index'),
    disabled: disabled ?? undefined,
    failedCount: numberField(record, 'failedCount', 'failed', 'failure') ?? undefined,
    headers,
    modelCount: numberField(record, 'modelCount', 'modelsCount', 'models_count') ?? 0,
    note: stringField(record, 'note'),
    prefix: stringField(record, 'prefix'),
    priority: numberField(record, 'priority') ?? undefined,
    proxyUrl: stringField(record, 'proxyUrl', 'proxy_url', 'proxy-url'),
    runtimeOnly: booleanField(record, 'runtimeOnly', 'runtime_only') ?? undefined,
    sizeBytes: numberField(record, 'sizeBytes', 'size_bytes', 'size') ?? undefined,
    statusMessage: stringField(record, 'statusMessage', 'status_message', 'message', 'error') ?? undefined,
    successCount: numberField(record, 'successCount', 'success') ?? undefined,
    updatedAt: stringField(record, 'updatedAt', 'modified', 'lastRefresh', 'last_refresh') ?? new Date(0).toISOString(),
    metadata: buildAuthFileMetadata(record, {
      disabled,
      headers,
      status,
      unavailable
    })
  };
}

function normalizeAuthFileStatus(value: string | null | undefined, unavailable?: boolean): GatewayAuthFile['status'] {
  if (value === 'invalid' || value === 'missing' || value === 'expired' || value === 'valid') return value;
  if (value === 'disabled') return 'valid';
  if (unavailable) return 'invalid';
  return 'valid';
}

function buildAuthFileMetadata(
  record: RecordBody,
  normalized: {
    disabled?: boolean;
    headers?: RecordBody;
    status: GatewayAuthFile['status'];
    unavailable?: boolean;
  }
): GatewayAuthFile['metadata'] {
  const metadata: GatewayAuthFile['metadata'] = {};
  const primitiveFields: Array<[string, GatewayAuthFileMetadataValue | undefined]> = [
    ['disabled', normalized.disabled],
    ['unavailable', normalized.unavailable],
    ['status', normalized.status],
    ['statusMessage', stringField(record, 'statusMessage', 'status_message', 'message', 'error')],
    ['sizeBytes', numberField(record, 'sizeBytes', 'size_bytes', 'size')],
    ['priority', numberField(record, 'priority')],
    ['authIndex', stringField(record, 'authIndex', 'auth_index')],
    ['successCount', numberField(record, 'successCount', 'success')],
    ['failedCount', numberField(record, 'failedCount', 'failed', 'failure')],
    ['note', stringField(record, 'note')],
    ['prefix', stringField(record, 'prefix')],
    ['proxyUrl', stringField(record, 'proxyUrl', 'proxy_url', 'proxy-url')],
    ['headersCount', normalized.headers ? Object.keys(normalized.headers).length : undefined]
  ];
  primitiveFields.forEach(([key, current]) => {
    if (current !== undefined) {
      metadata[key] = current;
    }
  });
  return metadata;
}

type GatewayAuthFileMetadataValue = NonNullable<GatewayAuthFile['metadata']>[string];

function normalizeStringRecord(record: RecordBody): Record<string, string> {
  const sensitiveHeaders = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'api-key',
    'proxy-authorization'
  ]);
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && !sensitiveHeaders.has(entry[0].trim().toLowerCase())
    )
  );
}

export function mapModel(
  value: unknown,
  fallbackProviderKind: GatewayProviderKind
): GatewaySystemModelsResponse['groups'][number]['models'][number] {
  const record = asRecord(value);
  const id = stringField(record, 'id', 'model', 'name') ?? String(value);
  return {
    id,
    displayName: stringField(record, 'displayName', 'name') ?? id,
    providerKind: normalizeProviderKind(stringField(record, 'providerKind')) ?? fallbackProviderKind,
    available: booleanField(record, 'available') ?? true
  };
}

export function mapRequestLog(value: unknown): GatewayRequestLogListResponse['items'][number] {
  const record = asRecord(value);
  return {
    id: stringField(record, 'id') ?? 'request-log',
    occurredAt: stringField(record, 'occurredAt', 'timestamp') ?? new Date(0).toISOString(),
    method: stringField(record, 'method') ?? 'GET',
    path: stringField(record, 'path', 'url') ?? '/',
    statusCode: numberField(record, 'statusCode', 'status') ?? 200,
    durationMs: numberField(record, 'durationMs') ?? 0,
    managementTraffic: booleanField(record, 'managementTraffic') ?? false,
    providerId: stringField(record, 'providerId'),
    apiKeyPrefix: stringField(record, 'apiKeyPrefix'),
    message: stringField(record, 'message') ?? undefined
  };
}

export function mapOAuthAlias(value: unknown): GatewayOAuthModelAliasListResponse['modelAliases'][number] {
  const record = asRecord(value);
  return {
    channel: stringField(record, 'channel') ?? 'default',
    sourceModel: stringField(record, 'sourceModel', 'source_model') ?? '',
    alias: stringField(record, 'alias') ?? '',
    fork: booleanField(record, 'fork') ?? false
  };
}

export function mapBatchUploadAuthFiles(
  body: RecordBody,
  request: GatewayAuthFileBatchUploadRequest
): GatewayAuthFileBatchUploadResponse {
  if (body.status === 'ok' && typeof body.uploaded === 'number') {
    return {
      accepted: request.files.map(file => ({
        authFileId: file.fileName,
        fileName: file.fileName,
        providerKind: normalizeProviderKind(file.providerKind ?? file.fileName),
        status: 'valid'
      })),
      rejected: []
    };
  }
  return {
    accepted: arrayBody(body, 'accepted', 'files').map((item, index) => {
      const record = asRecord(item);
      const fileName =
        typeof item === 'string'
          ? item
          : (stringField(record, 'fileName', 'name') ?? request.files[index]?.fileName ?? 'auth.json');
      return {
        authFileId: stringField(record, 'id') ?? fileName,
        fileName,
        providerKind: normalizeProviderKind(fileName),
        status: 'valid'
      };
    }),
    rejected: arrayBody(body, 'rejected').map(item => ({
      fileName: stringField(asRecord(item), 'fileName') ?? 'unknown',
      reason: stringField(asRecord(item), 'reason') ?? 'rejected'
    }))
  };
}

export function mapSystemInfo(connection: GatewayConnectionStatusResponse): GatewaySystemVersionResponse {
  return {
    version: connection.serverVersion ?? 'unknown',
    latestVersion: connection.serverVersion ?? 'unknown',
    buildDate: connection.serverBuildDate ?? undefined,
    updateAvailable: false,
    links: {}
  };
}

export function normalizeProviderKind(value: string | null): GatewayProviderKind {
  if (
    value === 'gemini' ||
    value === 'codex' ||
    value === 'claude' ||
    value === 'vertex' ||
    value === 'openai-compatible' ||
    value === 'ampcode'
  )
    return value;
  return 'custom';
}

export function normalizeOAuthStatus(record: RecordBody): GatewayOAuthStatusResponse['status'] {
  const status = stringField(record, 'status', 'state');
  if (status === 'completed' || status === 'ok') return 'completed';
  if (status === 'wait' || status === 'pending') return 'pending';
  if (status === 'expired' || status === 'error') return status;
  return 'pending';
}

export function queryString(params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  return query.size ? `?${query}` : '';
}

export function asRecord(value: unknown): RecordBody {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordBody) : {};
}

export function recordOf(value: unknown): RecordBody {
  return asRecord(value);
}

export function arrayBody(body: RecordBody, ...keys: string[]): unknown[] {
  if (Array.isArray(body)) return body;
  for (const key of keys) if (Array.isArray(body[key])) return body[key];
  return [];
}

export function stringField(record: RecordBody, ...keys: string[]): string | null {
  for (const key of keys) if (typeof record[key] === 'string') return record[key];
  return null;
}

export function numberField(record: RecordBody, ...keys: string[]): number | null {
  for (const key of keys) if (typeof record[key] === 'number' && Number.isFinite(record[key])) return record[key];
  return null;
}

export function booleanField(record: RecordBody, ...keys: string[]): boolean | null {
  for (const key of keys) if (typeof record[key] === 'boolean') return record[key];
  return null;
}

export function arrayOfStrings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;
}

export function maskSecret(value: string): string {
  return value.length < 6 ? '***' : `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export function now(): string {
  return new Date().toISOString();
}

const sensitiveProjectionKeyPattern = /(?:api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|cookie|secret)/i;

export function sanitizeGatewayProjectionValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => sanitizeGatewayProjectionValue(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveProjectionKeyPattern.test(key))
      .map(([key, nested]) => [key, sanitizeGatewayProjectionValue(nested)])
  );
}
