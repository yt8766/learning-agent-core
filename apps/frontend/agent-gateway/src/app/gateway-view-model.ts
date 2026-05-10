import type { GatewayQuota, GatewaySnapshot } from '@agent/core';

type GatewayRuntimeStatus = GatewaySnapshot['runtime'];
type GatewayConfig = GatewaySnapshot['config'];

export type GatewayViewId =
  | 'dashboard'
  | 'clients'
  | 'config'
  | 'aiProviders'
  | 'authFiles'
  | 'oauth'
  | 'quota'
  | 'system';

export const GATEWAY_ROUTE_BASE = '';

export const GATEWAY_VIEWS: Array<{ id: GatewayViewId; label: string; path: string }> = [
  { id: 'dashboard', label: '仪表盘', path: '/' },
  { id: 'clients', label: '调用方管理', path: '/clients' },
  { id: 'config', label: '配置面板', path: '/config' },
  { id: 'aiProviders', label: 'AI提供商', path: '/ai-providers' },
  { id: 'authFiles', label: '认证文件', path: '/auth-files' },
  { id: 'oauth', label: 'OAuth登录', path: '/oauth' },
  { id: 'quota', label: '配额管理', path: '/quota' },
  { id: 'system', label: '中心信息', path: '/system' }
];

export function resolveGatewayViewFromPath(pathname: string): GatewayViewId {
  return GATEWAY_VIEWS.find(view => view.path === pathname)?.id ?? 'dashboard';
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
