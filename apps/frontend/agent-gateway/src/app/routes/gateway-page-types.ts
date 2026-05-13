import type {
  GatewayAuthFileListResponse,
  GatewayClient,
  GatewayClientApiKeyListResponse,
  GatewayClientQuota,
  GatewayClientRequestLogListResponse,
  GatewayDashboardSummaryResponse,
  GatewayLogListResponse,
  GatewayProviderSpecificConfigListResponse,
  GatewayQuotaDetailListResponse,
  GatewayRuntimeHealthResponse,
  GatewaySnapshot,
  GatewayUsageAnalyticsResponse
} from '@agent/core';
import type {
  AgentGatewayApiClient,
  GatewayApiKeyListResponse,
  GatewayRawConfigResponse,
  GatewaySystemModelGroup,
  GatewaySystemVersionResponse
} from '../../api/agent-gateway-api';

export interface GatewayPageData {
  api?: AgentGatewayApiClient;
  apiKeys: GatewayApiKeyListResponse;
  authFiles: GatewayAuthFileListResponse;
  clientApiKeys: Record<string, GatewayClientApiKeyListResponse>;
  clientLogs: Record<string, GatewayClientRequestLogListResponse>;
  clientQuotas: Record<string, GatewayClientQuota>;
  clients: GatewayClient[];
  dashboard: GatewayDashboardSummaryResponse | null;
  logs?: GatewayLogListResponse;
  modelGroups: GatewaySystemModelGroup[];
  onGatewayDataChanged?: () => void;
  onLogout: () => void;
  providerConfigs: GatewayProviderSpecificConfigListResponse;
  quotaDetails: GatewayQuotaDetailListResponse;
  rawConfig: GatewayRawConfigResponse | null;
  runtimeHealth: GatewayRuntimeHealthResponse | null;
  snapshot?: GatewaySnapshot;
  systemInfo: GatewaySystemVersionResponse | null;
  usageAnalytics?: GatewayUsageAnalyticsResponse | null;
}
