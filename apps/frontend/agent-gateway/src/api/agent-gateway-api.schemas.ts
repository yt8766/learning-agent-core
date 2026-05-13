import {
  GatewayAccountingResponseSchema,
  GatewayApiKeyListResponseSchema,
  GatewayAuthFileBatchUploadResponseSchema,
  GatewayAuthFileDeleteResponseSchema,
  GatewayAuthFileListResponseSchema,
  GatewayAuthFileModelListResponseSchema,
  GatewayAuthFileSchema,
  GatewayClearLoginStorageResponseSchema,
  GatewayClearLogsResponseSchema,
  GatewayClientApiKeyListResponseSchema,
  GatewayClientApiKeySchema,
  GatewayClientListResponseSchema,
  GatewayClientQuotaSchema,
  GatewayClientRequestLogListResponseSchema,
  GatewayClientSchema,
  GatewayClientUsageSummarySchema,
  GatewayCompleteOAuthResponseSchema,
  GatewayConfigDiffResponseSchema,
  GatewayConfigSchema,
  GatewayConnectionProfileSchema,
  GatewayConnectionStatusResponseSchema,
  GatewayCreateClientApiKeyResponseSchema,
  GatewayCredentialFileSchema,
  GatewayDashboardSummaryResponseSchema,
  GatewayLogFileListResponseSchema,
  GatewayLogListResponseSchema,
  GatewayManagementApiCallResponseSchema,
  GatewayMigrationApplyResponseSchema,
  GatewayMigrationPreviewSchema,
  GatewayOAuthCallbackResponseSchema,
  GatewayOAuthModelAliasListResponseSchema,
  GatewayOAuthStatusResponseSchema,
  GatewayPreprocessResponseSchema,
  GatewayProbeResponseSchema,
  GatewayProviderCredentialSetSchema,
  GatewayProviderOAuthStartResponseSchema,
  GatewayProviderSpecificConfigListResponseSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayQuotaDetailListResponseSchema,
  GatewayQuotaSchema,
  GatewayRawConfigResponseSchema,
  GatewayReloadConfigResponseSchema,
  GatewayRelayResponseSchema,
  GatewayRequestLogSettingResponseSchema,
  GatewayRuntimeHealthResponseSchema,
  GatewaySnapshotSchema,
  GatewayStartOAuthResponseSchema,
  GatewaySystemModelsResponseSchema,
  GatewaySystemVersionResponseSchema,
  GatewayTokenCountResponseSchema,
  GatewayUsageAnalyticsResponseSchema,
  GatewayUsageListResponseSchema,
  GatewayVertexCredentialImportResponseSchema
} from '@agent/core';
import type {
  GatewayGeminiCliOAuthStartResponse,
  GatewayRuntimeHealthResponse,
  ParseableSchema
} from './agent-gateway-api.types';

export {
  GatewayAccountingResponseSchema,
  GatewayApiKeyListResponseSchema,
  GatewayAuthFileBatchUploadResponseSchema,
  GatewayAuthFileDeleteResponseSchema,
  GatewayAuthFileListResponseSchema,
  GatewayAuthFileModelListResponseSchema,
  GatewayAuthFileSchema,
  GatewayClearLoginStorageResponseSchema,
  GatewayClearLogsResponseSchema,
  GatewayClientApiKeyListResponseSchema,
  GatewayClientApiKeySchema,
  GatewayClientListResponseSchema,
  GatewayClientQuotaSchema,
  GatewayClientRequestLogListResponseSchema,
  GatewayClientSchema,
  GatewayClientUsageSummarySchema,
  GatewayCompleteOAuthResponseSchema,
  GatewayConfigDiffResponseSchema,
  GatewayConfigSchema,
  GatewayConnectionProfileSchema,
  GatewayConnectionStatusResponseSchema,
  GatewayCreateClientApiKeyResponseSchema,
  GatewayCredentialFileSchema,
  GatewayDashboardSummaryResponseSchema,
  GatewayLogFileListResponseSchema,
  GatewayLogListResponseSchema,
  GatewayManagementApiCallResponseSchema,
  GatewayMigrationApplyResponseSchema,
  GatewayMigrationPreviewSchema,
  GatewayOAuthCallbackResponseSchema,
  GatewayOAuthModelAliasListResponseSchema,
  GatewayOAuthStatusResponseSchema,
  GatewayPreprocessResponseSchema,
  GatewayProbeResponseSchema,
  GatewayProviderCredentialSetSchema,
  GatewayProviderOAuthStartResponseSchema,
  GatewayProviderSpecificConfigListResponseSchema,
  GatewayProviderSpecificConfigRecordSchema,
  GatewayQuotaDetailListResponseSchema,
  GatewayQuotaSchema,
  GatewayRawConfigResponseSchema,
  GatewayReloadConfigResponseSchema,
  GatewayRelayResponseSchema,
  GatewayRequestLogSettingResponseSchema,
  GatewaySnapshotSchema,
  GatewayStartOAuthResponseSchema,
  GatewaySystemModelsResponseSchema,
  GatewaySystemVersionResponseSchema,
  GatewayTokenCountResponseSchema,
  GatewayUsageAnalyticsResponseSchema,
  GatewayUsageListResponseSchema,
  GatewayVertexCredentialImportResponseSchema
};

export const voidResponseSchema: ParseableSchema<void> = {
  parse(): void {
    return undefined;
  }
};

export const stringResponseSchema: ParseableSchema<string> = {
  parse(payload: unknown): string {
    if (typeof payload !== 'string') {
      throw new Error('网关文本响应格式无效');
    }
    return payload;
  }
};

export const geminiCliOAuthStartResponseSchema: ParseableSchema<GatewayGeminiCliOAuthStartResponse> = {
  parse(payload: unknown): GatewayGeminiCliOAuthStartResponse {
    if (!isRecord(payload)) {
      throw new Error('Gemini CLI OAuth 响应格式无效');
    }
    const state = payload.state;
    const verificationUri = payload.verificationUri;
    const expiresAt = payload.expiresAt;
    if (typeof state !== 'string' || typeof verificationUri !== 'string' || typeof expiresAt !== 'string') {
      throw new Error('Gemini CLI OAuth 响应缺少 state、verificationUri 或 expiresAt');
    }
    return { state, verificationUri, expiresAt };
  }
};

export const gatewayRuntimeHealthResponseSchema: ParseableSchema<GatewayRuntimeHealthResponse> = {
  parse(payload: unknown): GatewayRuntimeHealthResponse {
    const parsed = GatewayRuntimeHealthResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error('Runtime health 响应格式无效');
    }
    return parsed.data;
  }
};

export function buildQueryString(query: object): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]: [string, unknown]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function arrayOf<T>(schema: ParseableSchema<T>): ParseableSchema<T[]> {
  return {
    parse(payload: unknown): T[] {
      if (!Array.isArray(payload)) {
        throw new Error('网关列表响应格式无效');
      }
      return payload.map(item => schema.parse(item));
    }
  };
}

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return payload !== null && typeof payload === 'object';
}
