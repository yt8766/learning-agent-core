import type {
  CreateProviderCredentialResponse,
  ProviderAdminRecord,
  ProviderAdminStatus,
  ProviderCredentialAdminRecord,
  ProviderCredentialAdminStatus,
  RotateProviderCredentialResponse,
  UpsertProviderRequest
} from '../contracts/admin-provider';
import {
  CreateProviderCredentialResponseSchema,
  ProviderAdminRecordSchema,
  ProviderCredentialAdminRecordSchema,
  RotateProviderCredentialResponseSchema,
  UpsertProviderRequestSchema
} from '../contracts/admin-provider';

export type ProviderAdminRecordInput = ProviderAdminRecord;

export type ProviderCredentialAdminRecordInput = ProviderCredentialAdminRecord & {
  plaintextApiKey?: string;
  encryptedApiKey?: string;
};

export function normalizeProviderAdminUpsert(input: UpsertProviderRequest): UpsertProviderRequest {
  return UpsertProviderRequestSchema.parse({
    ...input,
    name: input.name.trim(),
    baseUrl: trimTrailingSlashes(input.baseUrl.trim()),
    timeoutMs: input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : null
  });
}

export function buildProviderAdminRecord(input: ProviderAdminRecordInput): ProviderAdminRecord {
  return ProviderAdminRecordSchema.parse(input);
}

export function buildProviderCredentialAdminRecord(
  input: ProviderCredentialAdminRecordInput
): ProviderCredentialAdminRecord {
  return ProviderCredentialAdminRecordSchema.parse({
    id: input.id,
    providerId: input.providerId,
    keyPrefix: input.keyPrefix,
    fingerprint: input.fingerprint,
    keyVersion: input.keyVersion,
    status: input.status,
    createdAt: input.createdAt,
    rotatedAt: input.rotatedAt
  });
}

export function buildCreateProviderCredentialResponse(
  input: ProviderCredentialAdminRecordInput
): CreateProviderCredentialResponse {
  return CreateProviderCredentialResponseSchema.parse({
    credential: buildProviderCredentialAdminRecord(input)
  });
}

export function buildRotateProviderCredentialResponse(
  input: ProviderCredentialAdminRecordInput
): RotateProviderCredentialResponse {
  return RotateProviderCredentialResponseSchema.parse({
    credential: buildProviderCredentialAdminRecord(input)
  });
}

export function assertProviderStatusTransition(from: ProviderAdminStatus, to: ProviderAdminStatus): void {
  if (from === to) {
    return;
  }

  if (from === 'active' || from === 'disabled') {
    return;
  }
}

export function assertProviderCredentialStatusTransition(
  from: ProviderCredentialAdminStatus,
  to: ProviderCredentialAdminStatus
): void {
  if (from === to) {
    return;
  }

  if (from === 'active') {
    return;
  }

  if (from === 'rotated' && to === 'revoked') {
    return;
  }

  throw new Error('Rotated and revoked provider credentials are terminal and cannot be reactivated');
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}
