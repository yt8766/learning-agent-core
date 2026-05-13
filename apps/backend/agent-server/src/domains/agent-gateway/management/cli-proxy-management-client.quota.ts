import {
  GatewayQuotaDetailListResponseSchema,
  type GatewayManagementApiCallRequest,
  type GatewayManagementApiCallResponse,
  type GatewayProviderKind,
  type GatewayQuotaDetail,
  type GatewayQuotaDetailListResponse
} from '@agent/core';
import {
  arrayBody,
  asRecord,
  now,
  numberField,
  stringField,
  type RecordBody
} from './cli-proxy-management-client.helpers';

type ManagementApiCall = (request: GatewayManagementApiCallRequest) => Promise<GatewayManagementApiCallResponse>;

export async function refreshCliProxyQuotaDetails(
  providerKind: GatewayProviderKind,
  call: ManagementApiCall
): Promise<GatewayQuotaDetailListResponse> {
  const response = await call({
    providerKind,
    method: 'GET',
    path: '/quota',
    header: {}
  });
  return mapCliProxyQuotaDetails(providerKind, response);
}

function mapCliProxyQuotaDetails(
  providerKind: GatewayProviderKind,
  response: GatewayManagementApiCallResponse
): GatewayQuotaDetailListResponse {
  const body = asRecord(response.body);
  const nestedBody = asRecord(body.body);
  const source = quotaItems(body).length ? body : nestedBody;
  return GatewayQuotaDetailListResponseSchema.parse({
    items: quotaItems(source).map((item, index) => mapQuotaDetail(providerKind, item, index))
  });
}

function quotaItems(body: RecordBody): unknown[] {
  return arrayBody(body, 'items', 'quotas', 'quotaDetails', 'quota_details', 'records');
}

function mapQuotaDetail(providerKind: GatewayProviderKind, value: unknown, index: number): GatewayQuotaDetail {
  const record = asRecord(value);
  const providerId = stringField(record, 'providerId', 'providerKind', 'provider_id', 'provider_kind') ?? providerKind;
  const authFileId = stringField(record, 'authFileId', 'auth_file_id');
  const model = stringField(record, 'model', 'modelId', 'model_id') ?? authFileId ?? providerId;
  const window = stringField(record, 'window', 'period') ?? 'unknown';
  const scope = stringField(record, 'scope') ?? (authFileId ? 'model' : 'provider');
  const limit = Math.max(0, numberField(record, 'limit', 'limitTokens', 'limit_tokens') ?? 0);
  const used = Math.max(0, numberField(record, 'used', 'usedTokens', 'used_tokens') ?? 0);
  const remaining = Math.max(
    0,
    numberField(record, 'remaining', 'remainingTokens', 'remaining_tokens') ?? limit - used
  );
  return {
    id:
      stringField(record, 'id') ??
      [providerId, authFileId, model, window].filter((part): part is string => Boolean(part)).join(':') ??
      `${providerId}:quota:${index}`,
    providerId,
    model,
    scope,
    window,
    limit,
    used,
    remaining,
    resetAt: stringField(record, 'resetAt', 'reset_at'),
    refreshedAt: stringField(record, 'refreshedAt', 'refreshed_at') ?? now(),
    status: normalizeQuotaStatus(stringField(record, 'status'))
  };
}

function normalizeQuotaStatus(value: string | null): GatewayQuotaDetail['status'] {
  if (value === 'normal' || value === 'warning' || value === 'exceeded') return value;
  return 'warning';
}
