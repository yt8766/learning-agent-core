import type {
  GatewayAuthFile,
  GatewayQuotaDetailListResponse,
  GatewayProviderKind,
  GatewayProviderSpecificConfigRecord,
  GatewayRequestLogEntry,
  GatewayRequestLogListResponse,
  GatewayLogSearchRequest,
  GatewayManagementApiCallRequest,
  GatewayManagementApiCallResponse,
  GatewaySystemModelsResponse
} from '@agent/core';

export const fixedNow = '2026-05-08T00:00:00.000Z';

export function createMemoryProviderConfigs(): Map<string, GatewayProviderSpecificConfigRecord> {
  return new Map([
    [
      'gemini',
      {
        providerType: 'gemini',
        id: 'gemini',
        displayName: 'Gemini',
        enabled: true,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        models: [{ name: 'gemini-2.5-pro', testModel: 'gemini-2.5-pro' }],
        excludedModels: [],
        credentials: [{ credentialId: 'gemini-memory', apiKeyMasked: 'gem***key', status: 'valid' }],
        rawSource: 'adapter'
      }
    ]
  ]);
}

export function createMemoryAuthFiles(): Map<string, GatewayAuthFile> {
  return new Map([
    [
      'memory-gemini.json',
      {
        id: 'memory-gemini.json',
        providerId: 'gemini',
        providerKind: 'gemini',
        fileName: 'memory-gemini.json',
        path: '/memory/memory-gemini.json',
        status: 'valid',
        accountEmail: 'agent@example.com',
        projectId: 'agent-prod',
        modelCount: 1,
        updatedAt: fixedNow,
        metadata: { priority: 0 }
      }
    ]
  ]);
}

export function createMemoryLogs(): GatewayRequestLogEntry[] {
  return [
    {
      id: 'log-proxy-1',
      occurredAt: fixedNow,
      method: 'POST',
      path: '/v1/chat/completions',
      statusCode: 200,
      durationMs: 120,
      managementTraffic: false,
      providerId: 'openai-primary',
      apiKeyPrefix: 'sk-***abc',
      message: 'proxy request completed'
    },
    {
      id: 'log-management-1',
      occurredAt: fixedNow,
      method: 'GET',
      path: '/v0/management/config',
      statusCode: 200,
      durationMs: 36,
      managementTraffic: true,
      providerId: null,
      apiKeyPrefix: null,
      message: 'management profile checked'
    }
  ];
}

export function maskSecret(value: string): string {
  return value.length < 6 ? '***' : `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
  return Number.isFinite(value) && value && value > 0 ? Math.min(Math.floor(value), max) : fallback;
}

export function providerTypeToKind(
  value: GatewayProviderSpecificConfigRecord['providerType'] | undefined
): GatewayProviderKind {
  if (value === 'openaiCompatible') return 'openai-compatible';
  return value ?? 'custom';
}

export function inferAuthFileProviderKind(fileName: string): GatewayProviderKind {
  const normalized = fileName.toLowerCase();
  if (normalized.includes('gemini')) return 'gemini';
  if (normalized.includes('codex')) return 'codex';
  if (normalized.includes('claude') || normalized.includes('anthropic')) return 'claude';
  if (normalized.includes('vertex')) return 'vertex';
  if (normalized.includes('ampcode')) return 'ampcode';
  return 'custom';
}

export function createMemoryAuthFile(authFileId: string): GatewayAuthFile {
  const providerKind = inferAuthFileProviderKind(authFileId);
  return {
    id: authFileId,
    providerId: providerKind,
    providerKind,
    fileName: authFileId,
    path: `/memory/${authFileId}`,
    status: 'valid',
    accountEmail: null,
    projectId: null,
    modelCount: 0,
    updatedAt: fixedNow,
    metadata: {}
  };
}

export function createMemoryQuotaDetails(): GatewayQuotaDetailListResponse {
  return {
    items: [
      {
        id: 'claude-daily',
        providerId: 'claude',
        model: 'claude-opus-4',
        scope: 'daily',
        window: '24h',
        limit: 1000,
        used: 900,
        remaining: 100,
        resetAt: '2026-05-09T00:00:00.000Z',
        refreshedAt: fixedNow,
        status: 'warning'
      }
    ]
  };
}

export function createMemorySystemModels(): GatewaySystemModelsResponse {
  return {
    groups: [
      {
        providerId: 'openai',
        providerKind: 'openai-compatible',
        models: [
          {
            id: 'gpt-5.4',
            displayName: 'gpt-5.4',
            providerKind: 'openai-compatible',
            available: true
          }
        ]
      }
    ]
  };
}

export function projectMemoryLogs(
  logs: GatewayRequestLogEntry[],
  request: GatewayLogSearchRequest
): GatewayRequestLogListResponse {
  const limit = normalizeLimit(request.limit, 100, 500);
  const query = request.query?.trim().toLowerCase();
  const items = logs.filter(item => {
    if (request.hideManagementTraffic && item.managementTraffic) return false;
    if (request.after && item.occurredAt <= request.after) return false;
    if (!query) return true;
    return (
      item.message?.toLowerCase().includes(query) ||
      item.path.toLowerCase().includes(query) ||
      item.method.toLowerCase().includes(query) ||
      String(item.statusCode).includes(query)
    );
  });
  return {
    items: items.slice(0, limit).map(item => ({ ...item })),
    total: items.length,
    nextCursor: null
  };
}

export function createMemoryManagementApiCall(
  request: GatewayManagementApiCallRequest
): GatewayManagementApiCallResponse {
  const body = { providerKind: request.providerKind, path: request.path ?? request.url ?? '', ok: true };
  return {
    ok: true,
    statusCode: 200,
    header: { 'content-type': ['application/json'] },
    bodyText: JSON.stringify(body),
    body,
    durationMs: 1
  };
}
