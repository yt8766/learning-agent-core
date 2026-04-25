import type { ApiKeyAdminStatus, CreateApiKeyResponse } from '../contracts/admin-api-key';

export interface ApiKeyAdminRecordInput {
  id: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  status: ApiKeyAdminStatus;
  allowAllModels: boolean;
  models: string[];
  rpmLimit: number | null;
  tpmLimit: number | null;
  dailyTokenLimit: number | null;
  dailyCostLimit: number | null;
  usedTokensToday: number;
  usedCostToday: number;
  requestCountToday: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export function buildCreateApiKeyResponse(input: {
  plaintext: string;
  record: ApiKeyAdminRecordInput;
}): CreateApiKeyResponse {
  return {
    key: {
      id: input.record.id,
      name: input.record.name,
      keyPrefix: input.record.keyPrefix,
      status: input.record.status,
      allowAllModels: input.record.allowAllModels,
      models: input.record.models,
      rpmLimit: input.record.rpmLimit,
      tpmLimit: input.record.tpmLimit,
      dailyTokenLimit: input.record.dailyTokenLimit,
      dailyCostLimit: input.record.dailyCostLimit,
      usedTokensToday: input.record.usedTokensToday,
      usedCostToday: input.record.usedCostToday,
      requestCountToday: input.record.requestCountToday,
      expiresAt: input.record.expiresAt,
      lastUsedAt: input.record.lastUsedAt,
      createdAt: input.record.createdAt,
      revokedAt: input.record.revokedAt
    },
    plaintext: input.plaintext
  };
}

export function assertApiKeyStatusTransition(from: ApiKeyAdminStatus, to: ApiKeyAdminStatus): void {
  if (from === 'revoked' && to !== 'revoked') {
    throw new Error('Revoked API keys are terminal and cannot be re-enabled');
  }
}

export function normalizeApiKeyModelPermissions(input: { allowAllModels: boolean; models: string[] }): string[] {
  if (input.allowAllModels) {
    return [];
  }

  return Array.from(new Set(input.models));
}
