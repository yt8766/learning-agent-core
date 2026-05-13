import type {
  GatewayAuthFile,
  GatewayAuthFileBatchUploadRequest,
  GatewayAuthFileBatchUploadResponse,
  GatewayAuthFileDeleteRequest,
  GatewayAuthFileDeleteResponse
} from '@agent/core';
import type { ProviderQuotaAuthFileProjection } from '../runtime-engine/accounting/provider-quota-inspector';
import {
  fixedNow,
  inferAuthFileProviderKind,
  sanitizeGatewayMetadata
} from './memory-agent-gateway-management-client.helpers';

export function uploadMemoryAuthFiles(
  request: GatewayAuthFileBatchUploadRequest,
  authFiles: Map<string, GatewayAuthFile>
): GatewayAuthFileBatchUploadResponse {
  const accepted = request.files.map(file => {
    const providerKind = file.providerKind ?? inferAuthFileProviderKind(file.fileName);
    const metadata = parseAuthFileContent(file.contentBase64);
    const safeMetadata = {
      ...sanitizeGatewayMetadata(metadata),
      ...projectQuotaMetadata(metadata),
      ...projectModelMetadata(metadata)
    };
    const authFile: GatewayAuthFile = {
      id: file.fileName,
      providerId: providerKind,
      providerKind,
      fileName: file.fileName,
      path: `/memory/${file.fileName}`,
      status: authFileStatus(metadata.status),
      accountEmail: stringOrNull(metadata.accountEmail),
      projectId: stringOrNull(metadata.projectId),
      modelCount: stringArray(metadata.models).length || 1,
      updatedAt: fixedNow,
      metadata: { contentBytes: file.contentBase64.length, ...safeMetadata }
    };
    authFiles.set(file.fileName, authFile);
    return {
      authFileId: authFile.id,
      fileName: authFile.fileName,
      providerKind: authFile.providerKind,
      status: authFile.status
    };
  });
  return { accepted, rejected: [] };
}

export function deleteMemoryAuthFiles(
  request: GatewayAuthFileDeleteRequest,
  authFiles: Map<string, GatewayAuthFile>
): GatewayAuthFileDeleteResponse {
  const names = request.all ? Array.from(authFiles.keys()) : (request.names ?? []);
  const deleted: string[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];
  for (const name of names) {
    if (authFiles.delete(name)) deleted.push(name);
    else skipped.push({ name, reason: 'not found' });
  }
  return { deleted, skipped };
}

export function parseAuthFileContent(contentBase64: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(contentBase64, 'base64').toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { status: 'invalid', error: 'invalid auth file' };
  }
}

export function authFileStatus(value: unknown): GatewayAuthFile['status'] {
  return value === 'missing' || value === 'expired' || value === 'invalid' ? value : 'valid';
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function toQuotaAuthFileProjection(authFile: GatewayAuthFile): ProviderQuotaAuthFileProjection {
  const metadata = authFile.metadata ?? {};
  return {
    id: authFile.id,
    providerKind: authFile.providerKind,
    accountEmail: authFile.accountEmail,
    projectId: authFile.projectId,
    models: stringArray(metadata.models).length ? stringArray(metadata.models) : modelsFromMetadata(metadata),
    status: authFile.status,
    error: typeof metadata.error === 'string' ? metadata.error : undefined,
    quota: quotaFromMetadata(metadata)
  };
}

function projectModelMetadata(metadata: Record<string, unknown>): Record<string, string> {
  const models = stringArray(metadata.models);
  return Object.fromEntries(models.map((model, index) => [`model${index}`, model]));
}

function projectQuotaMetadata(metadata: Record<string, unknown>): Record<string, string | number | null> {
  const quota =
    metadata.quota && typeof metadata.quota === 'object' && !Array.isArray(metadata.quota) ? metadata.quota : {};
  return Object.assign(
    {},
    ...quotaWindowMetadata(quota as Record<string, unknown>, 'fiveHour', 'FiveHour'),
    ...quotaWindowMetadata(quota as Record<string, unknown>, 'daily', 'Daily'),
    ...quotaWindowMetadata(quota as Record<string, unknown>, 'weekly', 'Weekly'),
    ...quotaWindowMetadata(quota as Record<string, unknown>, 'monthly', 'Monthly'),
    ...quotaWindowMetadata(quota as Record<string, unknown>, 'rolling', 'Rolling')
  );
}

function modelsFromMetadata(metadata: Record<string, unknown>): string[] {
  return Object.entries(metadata)
    .filter(([key, value]) => /^model\d+$/.test(key) && typeof value === 'string')
    .sort(([left], [right]) => Number(left.slice(5)) - Number(right.slice(5)))
    .map(([, value]) => value as string);
}

function quotaFromMetadata(metadata: Record<string, unknown>): ProviderQuotaAuthFileProjection['quota'] {
  const quota: NonNullable<ProviderQuotaAuthFileProjection['quota']> = {};
  assignQuotaWindow(quota, metadata, 'fiveHour', 'FiveHour');
  assignQuotaWindow(quota, metadata, 'daily', 'Daily');
  assignQuotaWindow(quota, metadata, 'weekly', 'Weekly');
  assignQuotaWindow(quota, metadata, 'monthly', 'Monthly');
  assignQuotaWindow(quota, metadata, 'rolling', 'Rolling');
  return Object.keys(quota).length ? quota : undefined;
}

function quotaWindowMetadata(
  quota: Record<string, unknown>,
  sourceKey: string,
  metadataKey: string
): Array<Record<string, string | number | null>> {
  const window =
    quota[sourceKey] && typeof quota[sourceKey] === 'object' ? (quota[sourceKey] as Record<string, unknown>) : {};
  return [
    {
      [`quota${metadataKey}Limit`]: numberOrNull(window.limit),
      [`quota${metadataKey}Used`]: numberOrNull(window.used),
      [`quota${metadataKey}ResetAt`]: stringOrNull(window.resetAt)
    }
  ];
}

function assignQuotaWindow(
  quota: NonNullable<ProviderQuotaAuthFileProjection['quota']>,
  metadata: Record<string, unknown>,
  quotaKey: keyof NonNullable<ProviderQuotaAuthFileProjection['quota']>,
  metadataKey: string
): void {
  const limit = numberOrNull(metadata[`quota${metadataKey}Limit`]);
  const used = numberOrNull(metadata[`quota${metadataKey}Used`]);
  if (limit === null || used === null) return;
  quota[quotaKey] = {
    limit,
    used,
    resetAt: stringOrNull(metadata[`quota${metadataKey}ResetAt`])
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
