import { adminFetch } from '../auth/admin-client-auth';
import type { ApiKeyAdminSummary, CreateApiKeyResponse } from '../contracts/admin-api-key';
import type { AdminDashboardResponse, AdminRequestLogEntry, AdminRequestLogStatus } from '../contracts/admin-logs';
import type { GatewayModelAdminRecord, GatewayModelCapability } from '../contracts/admin-model';
import type { ProviderAdminKind, ProviderAdminStatus, ProviderAdminSummary } from '../contracts/admin-provider';

export type AdminProviderSummary = ProviderAdminSummary;

export interface AdminConsoleData {
  keys: ApiKeyAdminSummary[];
  providers: AdminProviderSummary[];
  models: GatewayModelAdminRecord[];
  operations?: AdminOperationsData;
}

export interface AdminConsoleDataPatch {
  keys?: ApiKeyAdminSummary[];
  providers?: AdminProviderSummary[];
  models?: GatewayModelAdminRecord[];
  operations?: AdminOperationsData;
}

export interface AdminOperationsData {
  dashboard: AdminDashboardResponse;
  logs: AdminRequestLogEntry[];
}

export type AdminConsoleDataCenter =
  | 'runtime'
  | 'models'
  | 'providers'
  | 'keys'
  | 'logs'
  | 'connector-policy'
  | 'approvals'
  | 'evidence';

export interface AdminLogFilters {
  keyId?: string;
  model?: string;
  provider?: string;
  status?: AdminRequestLogStatus;
}

export interface ApiKeyFormInput {
  name: string;
  allowAllModels: boolean;
  models: string;
  rpmLimit: string;
  tpmLimit: string;
  dailyTokenLimit: string;
  dailyCostLimit: string;
  expiresAt: string;
}

export interface ProviderFormInput {
  name: string;
  kind: ProviderAdminKind;
  status: ProviderAdminStatus;
  baseUrl: string;
  timeoutMs: string;
  plaintextApiKey: string;
}

export interface ModelFormInput {
  alias: string;
  providerId: string;
  providerModel: string;
  contextWindow: string;
  capabilities: string;
  inputPricePer1mTokens: string;
  outputPricePer1mTokens: string;
  fallbackAliases: string;
  adminOnly: boolean;
  enabled: boolean;
}

export const emptyAdminConsoleData: AdminConsoleData = {
  keys: [],
  providers: [],
  models: [],
  operations: emptyOperationsData()
};

export const providerKinds: ProviderAdminKind[] = ['openai', 'minimax', 'mimo', 'mock', 'openai-compatible'];

export async function loadAdminConsoleData(): Promise<AdminConsoleData> {
  const [keysResponse, providersResponse, modelsResponse, operations] = await Promise.all([
    adminFetch('/api/admin/keys'),
    adminFetch('/api/admin/providers'),
    adminFetch('/api/admin/models'),
    loadAdminLogsData()
  ]);

  const [keysPayload, providersPayload, modelsPayload] = await Promise.all([
    readJson<{ items: ApiKeyAdminSummary[] }>(keysResponse),
    readJson<{ providers: AdminProviderSummary[] }>(providersResponse),
    readJson<{ models: GatewayModelAdminRecord[] }>(modelsResponse)
  ]);

  return {
    keys: keysPayload.items,
    providers: providersPayload.providers,
    models: modelsPayload.models,
    operations
  };
}

export async function loadAdminConsoleDataForCenter(center: AdminConsoleDataCenter): Promise<AdminConsoleDataPatch> {
  if (center === 'models') {
    const response = await adminFetch('/api/admin/models');
    const payload = await readJson<{ models: GatewayModelAdminRecord[] }>(response);
    return { models: payload.models };
  }

  if (center === 'providers') {
    const response = await adminFetch('/api/admin/providers');
    const payload = await readJson<{ providers: AdminProviderSummary[] }>(response);
    return { providers: payload.providers };
  }

  if (center === 'keys') {
    const response = await adminFetch('/api/admin/keys');
    const payload = await readJson<{ items: ApiKeyAdminSummary[] }>(response);
    return { keys: payload.items };
  }

  if (center === 'runtime') {
    const dashboardResponse = await adminFetch('/api/admin/dashboard');
    const dashboard = await readJson<AdminDashboardResponse>(dashboardResponse);
    return { operations: { dashboard, logs: [] } };
  }

  if (center === 'logs') {
    return { operations: await loadAdminLogsData() };
  }

  return {};
}

export async function loadAdminLogsData(filters: AdminLogFilters = {}): Promise<AdminOperationsData> {
  const query = adminLogQueryString(filters);
  const [dashboardResponse, logsResponse] = await Promise.all([
    adminFetch(`/api/admin/dashboard${query}`),
    adminFetch(`/api/admin/logs${query}`)
  ]);
  const [dashboardPayload, logsPayload] = await Promise.all([
    readJson<AdminDashboardResponse>(dashboardResponse),
    readJson<{ items: AdminRequestLogEntry[] }>(logsResponse)
  ]);

  return {
    dashboard: dashboardPayload,
    logs: logsPayload.items
  };
}

export function normalizeAdminConsoleData(data: AdminConsoleData): Required<AdminConsoleData> {
  return {
    keys: data.keys,
    providers: data.providers,
    models: data.models,
    operations: data.operations ?? emptyOperationsData()
  };
}

export function mergeAdminConsoleData(
  data: Required<AdminConsoleData>,
  patch: AdminConsoleDataPatch
): Required<AdminConsoleData> {
  return {
    keys: patch.keys ?? data.keys,
    providers: patch.providers ?? data.providers,
    models: patch.models ?? data.models,
    operations: patch.operations ?? data.operations
  };
}

export async function createApiKeyFromForm(input: ApiKeyFormInput): Promise<CreateApiKeyResponse> {
  const response = await adminFetch('/api/admin/keys', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      name: input.name.trim(),
      allowAllModels: input.allowAllModels,
      models: input.allowAllModels ? [] : splitList(input.models),
      rpmLimit: nullablePositiveInt(input.rpmLimit),
      tpmLimit: nullablePositiveInt(input.tpmLimit),
      dailyTokenLimit: nullablePositiveInt(input.dailyTokenLimit),
      dailyCostLimit: nullableNonnegativeNumber(input.dailyCostLimit),
      expiresAt: nullableDateTime(input.expiresAt)
    })
  });

  return readJson<CreateApiKeyResponse>(response);
}

export async function revokeApiKey(keyId: string): Promise<ApiKeyAdminSummary> {
  const response = await adminFetch(`/api/admin/keys/${keyId}/revoke`, {
    method: 'POST',
    headers: jsonHeaders()
  });

  return readJson<ApiKeyAdminSummary>(response);
}

export async function updateApiKeyFromForm(keyId: string, input: ApiKeyFormInput): Promise<ApiKeyAdminSummary> {
  const response = await adminFetch(`/api/admin/keys/${keyId}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify({
      name: input.name.trim(),
      allowAllModels: input.allowAllModels,
      models: input.allowAllModels ? [] : splitList(input.models),
      rpmLimit: nullablePositiveInt(input.rpmLimit),
      tpmLimit: nullablePositiveInt(input.tpmLimit),
      dailyTokenLimit: nullablePositiveInt(input.dailyTokenLimit),
      dailyCostLimit: nullableNonnegativeNumber(input.dailyCostLimit),
      expiresAt: nullableDateTime(input.expiresAt)
    })
  });

  return readJson<ApiKeyAdminSummary>(response);
}

export async function deleteApiKey(keyId: string): Promise<ApiKeyAdminSummary> {
  const response = await adminFetch(`/api/admin/keys/${keyId}`, {
    method: 'DELETE',
    headers: jsonHeaders()
  });

  return readJson<ApiKeyAdminSummary>(response);
}

export async function createProviderFromForm(input: ProviderFormInput): Promise<AdminProviderSummary> {
  const providerResponse = await adminFetch('/api/admin/providers', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      name: input.name.trim(),
      kind: input.kind,
      status: input.status,
      baseUrl: input.baseUrl.trim(),
      timeoutMs: nullablePositiveInt(input.timeoutMs),
      plaintextApiKey: optionalString(input.plaintextApiKey)
    })
  });
  const providerPayload = await readJson<{ provider: AdminProviderSummary }>(providerResponse);
  return providerPayload.provider;
}

export async function updateProviderFromForm(
  providerId: string,
  input: ProviderFormInput
): Promise<AdminProviderSummary> {
  const response = await adminFetch(`/api/admin/providers/${providerId}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify({
      name: input.name.trim(),
      kind: input.kind,
      status: input.status,
      baseUrl: input.baseUrl.trim(),
      timeoutMs: nullablePositiveInt(input.timeoutMs),
      plaintextApiKey: optionalString(input.plaintextApiKey)
    })
  });
  const payload = await readJson<{ provider: AdminProviderSummary }>(response);
  return payload.provider;
}

export async function deleteProvider(providerId: string): Promise<AdminProviderSummary> {
  const response = await adminFetch(`/api/admin/providers/${providerId}`, {
    method: 'DELETE',
    headers: jsonHeaders()
  });
  const payload = await readJson<{ provider: AdminProviderSummary }>(response);

  return payload.provider;
}

export async function createModelFromForm(input: ModelFormInput): Promise<GatewayModelAdminRecord> {
  const response = await adminFetch('/api/admin/models', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({
      alias: input.alias.trim(),
      providerId: input.providerId.trim(),
      providerModel: input.providerModel.trim(),
      enabled: input.enabled,
      contextWindow: nullablePositiveInt(input.contextWindow) ?? 1,
      inputPricePer1mTokens: nullableNonnegativeNumber(input.inputPricePer1mTokens),
      outputPricePer1mTokens: nullableNonnegativeNumber(input.outputPricePer1mTokens),
      capabilities: splitList(input.capabilities) as GatewayModelCapability[],
      fallbackAliases: splitList(input.fallbackAliases),
      adminOnly: input.adminOnly
    })
  });
  const payload = await readJson<{ model: GatewayModelAdminRecord }>(response);
  return payload.model;
}

export async function updateModelFromForm(modelId: string, input: ModelFormInput): Promise<GatewayModelAdminRecord> {
  const response = await adminFetch(`/api/admin/models/${modelId}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify({
      alias: input.alias.trim(),
      providerId: input.providerId.trim(),
      providerModel: input.providerModel.trim(),
      enabled: input.enabled,
      contextWindow: nullablePositiveInt(input.contextWindow) ?? 1,
      inputPricePer1mTokens: nullableNonnegativeNumber(input.inputPricePer1mTokens),
      outputPricePer1mTokens: nullableNonnegativeNumber(input.outputPricePer1mTokens),
      capabilities: splitList(input.capabilities) as GatewayModelCapability[],
      fallbackAliases: splitList(input.fallbackAliases),
      adminOnly: input.adminOnly
    })
  });
  const payload = await readJson<{ model: GatewayModelAdminRecord }>(response);
  return payload.model;
}

export async function deleteModel(modelId: string): Promise<GatewayModelAdminRecord> {
  const response = await adminFetch(`/api/admin/models/${modelId}`, {
    method: 'DELETE',
    headers: jsonHeaders()
  });
  const payload = await readJson<{ model: GatewayModelAdminRecord }>(response);
  return payload.model;
}

export function apiKeyFormInput(formData: FormData): ApiKeyFormInput {
  return {
    name: stringValue(formData, 'name'),
    allowAllModels: formData.get('allowAllModels') === 'on',
    models: stringValue(formData, 'models'),
    rpmLimit: stringValue(formData, 'rpmLimit'),
    tpmLimit: stringValue(formData, 'tpmLimit'),
    dailyTokenLimit: stringValue(formData, 'dailyTokenLimit'),
    dailyCostLimit: stringValue(formData, 'dailyCostLimit'),
    expiresAt: stringValue(formData, 'expiresAt')
  };
}

export function providerFormInput(formData: FormData): ProviderFormInput {
  return {
    name: stringValue(formData, 'name'),
    kind: stringValue(formData, 'kind') as ProviderAdminKind,
    status: stringValue(formData, 'status') as ProviderAdminStatus,
    baseUrl: stringValue(formData, 'baseUrl'),
    timeoutMs: stringValue(formData, 'timeoutMs'),
    plaintextApiKey: stringValue(formData, 'plaintextApiKey')
  };
}

export function modelFormInput(formData: FormData): ModelFormInput {
  return {
    alias: stringValue(formData, 'alias'),
    providerId: stringValue(formData, 'providerId'),
    providerModel: stringValue(formData, 'providerModel'),
    contextWindow: stringValue(formData, 'contextWindow'),
    capabilities: stringValue(formData, 'capabilities'),
    inputPricePer1mTokens: stringValue(formData, 'inputPricePer1mTokens'),
    outputPricePer1mTokens: stringValue(formData, 'outputPricePer1mTokens'),
    fallbackAliases: stringValue(formData, 'fallbackAliases'),
    adminOnly: formData.get('adminOnly') === 'on',
    enabled: formData.get('enabled') === 'on'
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload;
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload && 'error' in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === 'string') {
      return error.message;
    }
  }

  return 'Admin request failed.';
}

function jsonHeaders(): Headers {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  return headers;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function nullablePositiveInt(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nullableNonnegativeNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function nullableDateTime(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  return new Date(value).toISOString();
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function adminLogQueryString(filters: AdminLogFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

function emptyOperationsData(): AdminOperationsData {
  return {
    dashboard: {
      summary: {
        requestCount: 0,
        totalTokens: 0,
        estimatedCost: 0,
        failureRate: 0,
        averageLatencyMs: 0
      },
      topModels: [],
      topKeys: [],
      topProviders: []
    },
    logs: []
  };
}
