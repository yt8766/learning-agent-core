import type {
  GatewayAuthFile,
  GatewayLogFileListResponse,
  GatewayProviderSpecificConfigRecord,
  GatewayProviderType
} from '@agent/core';

export type CliProxyProviderEndpoint = 'gemini-api-key' | 'codex-api-key' | 'claude-api-key' | 'vertex-api-key';

export const PROVIDER_ENDPOINT_TO_TYPE: Record<CliProxyProviderEndpoint, GatewayProviderType> = {
  'gemini-api-key': 'gemini',
  'codex-api-key': 'codex',
  'claude-api-key': 'claude',
  'vertex-api-key': 'vertex'
};

export const TYPE_TO_PROVIDER_ENDPOINT: Record<GatewayProviderType, string> = {
  gemini: 'gemini-api-key',
  codex: 'codex-api-key',
  claude: 'claude-api-key',
  vertex: 'vertex-api-key',
  openaiCompatible: 'openai-compatibility',
  ampcode: 'ampcode'
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function stringField(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function booleanField(source: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
  }
  return undefined;
}

export function numberField(source: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

export function normalizeValueBody(body: unknown): unknown {
  if (!isRecord(body)) return body;
  return body.value ?? body;
}

export function normalizeProviderEndpoint(value: string): CliProxyProviderEndpoint {
  if (value in PROVIDER_ENDPOINT_TO_TYPE) return value as CliProxyProviderEndpoint;
  throw new Error(`Unsupported CLIProxy provider endpoint: ${value}`);
}

export function parseSimpleYamlConfig(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.indexOf(':');
    if (separator < 1) return;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key) return;
    if (rawValue === 'true') {
      result[key] = true;
      return;
    }
    if (rawValue === 'false') {
      result[key] = false;
      return;
    }
    const asNumber = Number(rawValue);
    result[key] = Number.isFinite(asNumber) && rawValue !== '' ? asNumber : rawValue.replace(/^["']|["']$/g, '');
  });
  return result;
}

export function projectProviderConfig(config: GatewayProviderSpecificConfigRecord): Record<string, unknown> {
  const credential = config.credentials[0];
  const payload: Record<string, unknown> = {
    'api-key': credential?.secretRef ?? credential?.apiKeyMasked ?? credential?.credentialId ?? '',
    disabled: !config.enabled
  };
  if (config.baseUrl) payload['base-url'] = config.baseUrl;
  if (config.priority !== undefined) payload.priority = config.priority;
  if (config.prefix) payload.prefix = config.prefix;
  if (config.proxyUrl) payload['proxy-url'] = config.proxyUrl;
  if (config.headers && Object.keys(config.headers).length) payload.headers = config.headers;
  if (config.excludedModels.length) payload['excluded-models'] = config.excludedModels;
  if (config.models.length) {
    payload.models = config.models.map(model => ({
      name: model.name,
      ...(model.alias ? { alias: model.alias } : {}),
      ...(model.priority !== undefined ? { priority: model.priority } : {}),
      ...(model.testModel ? { 'test-model': model.testModel } : {})
    }));
  }
  if (config.cloakPolicy) {
    payload.cloak = {
      ...(config.cloakPolicy.mode ? { mode: config.cloakPolicy.mode } : {}),
      ...(config.cloakPolicy.strictMode !== undefined ? { 'strict-mode': config.cloakPolicy.strictMode } : {}),
      ...(config.cloakPolicy.sensitiveWords.length ? { 'sensitive-words': config.cloakPolicy.sensitiveWords } : {})
    };
  }
  return payload;
}

export function projectOpenAICompatibility(config: GatewayProviderSpecificConfigRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: config.displayName,
    'base-url': config.baseUrl ?? '',
    disabled: !config.enabled,
    'api-key-entries': config.credentials.map(credential => ({
      'api-key': credential.secretRef ?? credential.apiKeyMasked ?? credential.credentialId,
      ...(credential.proxyUrl ? { 'proxy-url': credential.proxyUrl } : {}),
      ...(credential.headers ? { headers: credential.headers } : {})
    }))
  };
  if (config.prefix) payload.prefix = config.prefix;
  if (config.headers && Object.keys(config.headers).length) payload.headers = config.headers;
  if (config.priority !== undefined) payload.priority = config.priority;
  if (config.testModel) payload['test-model'] = config.testModel;
  if (config.models.length) {
    payload.models = config.models.map(model => ({
      name: model.name,
      ...(model.alias ? { alias: model.alias } : {}),
      ...(model.priority !== undefined ? { priority: model.priority } : {}),
      ...(model.testModel ? { 'test-model': model.testModel } : {})
    }));
  }
  return payload;
}

export function toProviderConfig(
  endpoint: CliProxyProviderEndpoint,
  value: unknown,
  index: number
): GatewayProviderSpecificConfigRecord {
  const source = isRecord(value) ? value : {};
  const providerType = PROVIDER_ENDPOINT_TO_TYPE[endpoint];
  const apiKey = stringField(source, 'api-key', 'apiKey') ?? '';
  return {
    providerType,
    id: `${providerType}-${index}`,
    displayName: providerType,
    enabled: booleanField(source, 'disabled') === true ? false : true,
    baseUrl: stringField(source, 'base-url', 'baseUrl') ?? null,
    priority: numberField(source, 'priority'),
    prefix: stringField(source, 'prefix'),
    proxyUrl: stringField(source, 'proxy-url', 'proxyUrl') ?? null,
    headers: isRecord(source.headers) ? stringifyRecordValues(source.headers) : undefined,
    models: normalizeModels(source.models),
    excludedModels: normalizeStringArray(source['excluded-models'] ?? source.excludedModels),
    credentials: [
      {
        credentialId: apiKey || `${providerType}-${index}-key`,
        apiKeyMasked: apiKey,
        status: booleanField(source, 'disabled') === true ? 'disabled' : 'valid'
      }
    ],
    rawSource: 'config'
  };
}

export function toOpenAIProviderConfig(value: unknown, index: number): GatewayProviderSpecificConfigRecord {
  if (isGatewayProviderRecord(value)) return value;
  const source = isRecord(value) ? value : {};
  const entries = Array.isArray(source['api-key-entries']) ? source['api-key-entries'] : [];
  const name = stringField(source, 'name') ?? `OpenAI Compatible ${index + 1}`;
  return {
    providerType: 'openaiCompatible',
    id: slugify(name) || `openai-compatible-${index}`,
    displayName: name,
    enabled: booleanField(source, 'disabled') === true ? false : true,
    baseUrl: stringField(source, 'base-url', 'baseUrl') ?? null,
    priority: numberField(source, 'priority'),
    prefix: stringField(source, 'prefix'),
    headers: isRecord(source.headers) ? stringifyRecordValues(source.headers) : undefined,
    models: normalizeModels(source.models),
    excludedModels: [],
    credentials: entries.map((entry, entryIndex) => {
      const record = isRecord(entry) ? entry : {};
      const apiKey = stringField(record, 'api-key', 'apiKey') ?? `openai-compatible-${index}-${entryIndex}`;
      return {
        credentialId: apiKey,
        apiKeyMasked: apiKey,
        proxyUrl: stringField(record, 'proxy-url', 'proxyUrl') ?? null,
        headers: isRecord(record.headers) ? stringifyRecordValues(record.headers) : undefined,
        status: 'valid' as const
      };
    }),
    testModel: stringField(source, 'test-model', 'testModel'),
    rawSource: 'config'
  };
}

export function projectAuthFile(authFile: GatewayAuthFile): Record<string, unknown> {
  return {
    name: authFile.fileName,
    provider: authFile.providerKind,
    status: authFile.status,
    disabled: authFile.disabled ?? false,
    path: authFile.path,
    modtime: Date.parse(authFile.updatedAt),
    email: authFile.accountEmail ?? undefined,
    project_id: authFile.projectId ?? undefined,
    auth_index: authFile.authIndex ?? undefined,
    model_count: authFile.modelCount,
    prefix: authFile.prefix ?? undefined,
    proxy_url: authFile.proxyUrl ?? undefined,
    headers: authFile.headers,
    priority: authFile.priority,
    note: authFile.note ?? undefined,
    runtime_only: authFile.runtimeOnly ?? false
  };
}

export function projectLogLines(
  items: Array<{
    occurredAt: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    message?: string | null;
  }>
): string[] {
  return items.map(item =>
    [item.occurredAt, item.method, item.path, item.statusCode, `${item.durationMs}ms`, item.message ?? '']
      .filter(Boolean)
      .join(' ')
  );
}

export function projectRequestErrorFiles(response: GatewayLogFileListResponse): Record<string, unknown> {
  return {
    files: response.items.map(item => ({
      name: item.fileName,
      size: item.sizeBytes,
      modified: Date.parse(item.modifiedAt)
    }))
  };
}

export function endpointFromRequestPath(request: { path?: string; url?: string; route?: { path?: string } }): string {
  const raw = request.path ?? request.url ?? request.route?.path ?? '';
  return raw.split('?')[0]?.split('/').filter(Boolean).at(-1) ?? '';
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeModels(value: unknown): GatewayProviderSpecificConfigRecord['models'] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      const source = isRecord(item) ? item : {};
      const name = stringField(source, 'name', 'id', 'model');
      if (!name) return null;
      const model: GatewayProviderSpecificConfigRecord['models'][number] = { name };
      const alias = stringField(source, 'alias');
      const priority = numberField(source, 'priority');
      const testModel = stringField(source, 'test-model', 'testModel');
      if (alias) model.alias = alias;
      if (priority !== undefined) model.priority = priority;
      if (testModel) model.testModel = testModel;
      return model;
    })
    .filter((item): item is GatewayProviderSpecificConfigRecord['models'][number] => item !== null);
}

function stringifyRecordValues(record: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, value]) => [key.trim(), String(value ?? '')])
      .filter(([key]) => Boolean(key))
  );
}

export function isGatewayProviderRecord(value: unknown): value is GatewayProviderSpecificConfigRecord {
  return isRecord(value) && typeof value.providerType === 'string' && typeof value.id === 'string';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
