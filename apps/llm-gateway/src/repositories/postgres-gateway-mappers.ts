import { GatewayError } from '../gateway/errors';
import type { GatewayKeyRecord, GatewayModelRecord } from '../gateway/gateway-service';
import type { ProviderRuntimeConfig } from '../providers/provider-adapter-registry';
import type { EncryptedProviderSecretPayload, ProviderSecretVault } from '../secrets/provider-secret-vault';
import type { InvocationLog } from '../usage/invocation-log';

export type PostgresProviderRuntimeConfig = ProviderRuntimeConfig & {
  providerKind: string;
};

interface UsageRecord {
  keyId: string;
  totalTokens: number;
  estimatedCost: number;
}

export function mapApiKeyRow(row: Record<string, unknown>): GatewayKeyRecord {
  const models = toStringArray(row.models);

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    status: row.status === 'disabled' || row.status === 'revoked' ? row.status : 'active',
    models: models.length > 0 ? models : ['*'],
    rpmLimit: toNullableNumber(row.rpm_limit),
    tpmLimit: toNullableNumber(row.tpm_limit),
    dailyTokenLimit: toNullableNumber(row.daily_token_limit),
    dailyCostLimit: toNullableNumber(row.daily_cost_limit),
    usedTokensToday: 0,
    usedCostToday: 0,
    expiresAt: row.expires_at ? toIsoString(row.expires_at) : null
  };
}

export function mapModelRow(row: Record<string, unknown>): GatewayModelRecord {
  return {
    alias: String(row.alias),
    provider: String(row.provider_id),
    providerModel: String(row.provider_model),
    enabled: Boolean(row.enabled),
    contextWindow: Number(row.context_window),
    inputPricePer1mTokens: toNullableNumber(row.input_price_per_1m_tokens),
    outputPricePer1mTokens: toNullableNumber(row.output_price_per_1m_tokens),
    fallbackAliases: toStringArray(row.fallback_aliases),
    adminOnly: Boolean(row.admin_only)
  };
}

export function mapProviderRuntimeConfig(
  row: Record<string, unknown>,
  providerSecretVault: ProviderSecretVault | undefined
): PostgresProviderRuntimeConfig {
  const providerId = String(row.provider_id);

  if (!providerSecretVault) {
    throw new GatewayError(
      'UPSTREAM_UNAVAILABLE',
      'Provider secret vault is required for Postgres provider runtime credentials.',
      503
    );
  }

  return {
    providerId,
    providerKind: String(row.provider_kind),
    baseUrl: String(row.base_url),
    apiKey: decryptProviderApiKey(providerId, row, providerSecretVault),
    timeoutMs: Number(row.timeout_ms ?? 30_000)
  };
}

export function mapInvocationLog(log: unknown): InvocationLog {
  const record = log as InvocationLog;

  return {
    keyId: String(record.keyId),
    requestedModel: String(record.requestedModel),
    model: String(record.model),
    providerModel: String(record.providerModel),
    provider: String(record.provider),
    status: record.status === 'error' ? 'error' : 'success',
    promptTokens: Number(record.promptTokens ?? 0),
    completionTokens: Number(record.completionTokens ?? 0),
    totalTokens: Number(record.totalTokens ?? 0),
    estimatedCost: Number(record.estimatedCost ?? 0),
    usageSource: record.usageSource,
    latencyMs: Number(record.latencyMs ?? 0),
    stream: Boolean(record.stream),
    fallbackAttemptCount: Number(record.fallbackAttemptCount ?? 0),
    ...(record.errorCode ? { errorCode: String(record.errorCode) } : {}),
    ...(record.errorMessage ? { errorMessage: String(record.errorMessage) } : {})
  };
}

export function mapUsageRecord(usage: unknown): UsageRecord {
  const record = usage as UsageRecord;

  return {
    keyId: String(record.keyId),
    totalTokens: Number(record.totalTokens ?? 0),
    estimatedCost: Number(record.estimatedCost ?? 0)
  };
}

function decryptProviderApiKey(
  providerId: string,
  row: Record<string, unknown>,
  providerSecretVault: ProviderSecretVault
): string {
  try {
    const payload = parseEncryptedProviderSecretPayload(row.encrypted_api_key);
    const rowKeyVersion = String(row.key_version ?? '');

    if (rowKeyVersion && payload.keyVersion !== rowKeyVersion) {
      throw new Error('Provider credential key version does not match encrypted payload');
    }

    return providerSecretVault.decrypt(payload);
  } catch {
    throw new GatewayError(
      'UPSTREAM_UNAVAILABLE',
      `Provider credential for ${providerId} could not be decrypted.`,
      503
    );
  }
}

function parseEncryptedProviderSecretPayload(value: unknown): EncryptedProviderSecretPayload {
  const parsed = JSON.parse(String(value)) as Partial<EncryptedProviderSecretPayload>;

  if (
    parsed.algorithm !== 'AES-256-GCM' ||
    typeof parsed.keyVersion !== 'string' ||
    typeof parsed.iv !== 'string' ||
    typeof parsed.tag !== 'string' ||
    typeof parsed.ciphertext !== 'string'
  ) {
    throw new Error('Invalid encrypted provider secret payload');
  }

  return parsed as EncryptedProviderSecretPayload;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
