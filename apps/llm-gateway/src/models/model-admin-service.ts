import type {
  GatewayModelAdminRecord,
  GatewayModelCapability,
  UpsertGatewayModelRequest
} from '../contracts/admin-model';
import {
  GatewayModelAdminRecordSchema,
  GatewayModelCapabilitySchema,
  UpsertGatewayModelRequestSchema
} from '../contracts/admin-model';

type GatewayModelAdminUpsertInput = Omit<
  UpsertGatewayModelRequest,
  'contextWindow' | 'inputPricePer1mTokens' | 'outputPricePer1mTokens' | 'capabilities'
> & {
  contextWindow: number | string;
  inputPricePer1mTokens: number | string | null;
  outputPricePer1mTokens: number | string | null;
  capabilities: string[];
};

export function normalizeGatewayModelAdminUpsert(input: GatewayModelAdminUpsertInput): UpsertGatewayModelRequest {
  const alias = normalizeModelAlias(input.alias);

  return UpsertGatewayModelRequestSchema.parse({
    alias,
    providerId: input.providerId.trim(),
    providerModel: input.providerModel.trim(),
    enabled: input.enabled,
    contextWindow: normalizePositiveInteger(input.contextWindow),
    inputPricePer1mTokens: normalizeNullablePrice(input.inputPricePer1mTokens),
    outputPricePer1mTokens: normalizeNullablePrice(input.outputPricePer1mTokens),
    capabilities: normalizeCapabilities(input.capabilities),
    fallbackAliases: normalizeFallbackAliases(input.fallbackAliases, alias),
    adminOnly: input.adminOnly
  });
}

export function buildGatewayModelAdminRecord(input: GatewayModelAdminRecord): GatewayModelAdminRecord {
  const alias = normalizeModelAlias(input.alias);

  return GatewayModelAdminRecordSchema.parse({
    ...input,
    alias,
    providerId: input.providerId.trim(),
    providerModel: input.providerModel.trim(),
    capabilities: normalizeCapabilities(input.capabilities),
    fallbackAliases: normalizeFallbackAliases(input.fallbackAliases, alias)
  });
}

export function assertGatewayModelEnabledTransition(): void {
  return;
}

export function normalizeModelAlias(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeFallbackAliases(values: string[], currentAlias: string): string[] {
  const aliases = values.map(normalizeModelAlias).filter(alias => alias.length > 0 && alias !== currentAlias);
  return Array.from(new Set(aliases));
}

function normalizeCapabilities(values: string[]): GatewayModelCapability[] {
  const capabilities = values.map(value => GatewayModelCapabilitySchema.parse(value));
  return Array.from(new Set(capabilities));
}

function normalizePositiveInteger(value: number | string): number {
  if (typeof value === 'number') {
    return value;
  }

  return Number(value.trim());
}

function normalizeNullablePrice(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? Number(trimmed) : null;
}
