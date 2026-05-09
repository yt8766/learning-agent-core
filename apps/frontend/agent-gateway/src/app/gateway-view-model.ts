import type { GatewayQuota, GatewaySnapshot } from '@agent/core';

type GatewayRuntimeStatus = GatewaySnapshot['runtime'];
type GatewayConfig = GatewaySnapshot['config'];

export type GatewayViewId =
  | 'overview'
  | 'dashboard'
  | 'connection'
  | 'config'
  | 'apiKeys'
  | 'providers'
  | 'providerConfig'
  | 'credentials'
  | 'authFilesManager'
  | 'oauthPolicy'
  | 'quotas'
  | 'quotaDetail'
  | 'pipeline'
  | 'logs'
  | 'system';

export const GATEWAY_ROUTE_BASE = '/gateway';

export const GATEWAY_VIEWS: Array<{ id: GatewayViewId; label: string; path: string }> = [
  { id: 'overview', label: '总览', path: GATEWAY_ROUTE_BASE },
  { id: 'dashboard', label: 'Dashboard', path: `${GATEWAY_ROUTE_BASE}/dashboard` },
  { id: 'connection', label: '连接', path: `${GATEWAY_ROUTE_BASE}/connection` },
  { id: 'config', label: '配置', path: `${GATEWAY_ROUTE_BASE}/config` },
  { id: 'apiKeys', label: 'API Keys', path: `${GATEWAY_ROUTE_BASE}/api-keys` },
  { id: 'providers', label: '上游方', path: `${GATEWAY_ROUTE_BASE}/providers` },
  { id: 'providerConfig', label: 'Provider Config', path: `${GATEWAY_ROUTE_BASE}/provider-config` },
  { id: 'credentials', label: '认证文件', path: `${GATEWAY_ROUTE_BASE}/credentials` },
  { id: 'authFilesManager', label: 'Auth Files', path: `${GATEWAY_ROUTE_BASE}/auth-files` },
  { id: 'oauthPolicy', label: 'OAuth Policy', path: `${GATEWAY_ROUTE_BASE}/oauth-policy` },
  { id: 'quotas', label: '配额', path: `${GATEWAY_ROUTE_BASE}/quotas` },
  { id: 'quotaDetail', label: 'Quota Detail', path: `${GATEWAY_ROUTE_BASE}/quota-detail` },
  { id: 'pipeline', label: '调用管线', path: `${GATEWAY_ROUTE_BASE}/pipeline` },
  { id: 'logs', label: '日志与探测', path: `${GATEWAY_ROUTE_BASE}/logs` },
  { id: 'system', label: '系统', path: `${GATEWAY_ROUTE_BASE}/system` }
];

export function resolveGatewayViewFromPath(pathname: string): GatewayViewId {
  return GATEWAY_VIEWS.find(view => view.path === pathname)?.id ?? 'overview';
}

export function formatGatewayDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function describeRuntimeStatus(runtime: GatewayRuntimeStatus): string {
  if (runtime.status === 'healthy') return '健康';
  if (runtime.status === 'degraded') return '降级';
  return '停用';
}

export function describeGatewaySwitch(value: boolean): string {
  return value ? '开启' : '关闭';
}

export function describeTokenStrategy(
  strategy: GatewayConfig['inputTokenStrategy'] | GatewayConfig['outputTokenStrategy']
): string {
  if (strategy === 'provider-reported') return '上游回传';
  if (strategy === 'hybrid') return '混合校准';
  if (strategy === 'postprocess') return '本地后处理';
  return '本地预处理';
}

export function quotaUsagePercent(quota: GatewayQuota): number {
  return Math.min(100, Math.round((quota.usedTokens / quota.limitTokens) * 100));
}
