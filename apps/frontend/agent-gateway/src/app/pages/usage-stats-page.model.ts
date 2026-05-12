import type { GatewayUsageAnalyticsResponse } from '@agent/core';

export type UsageTab = 'requestLogs' | 'providers' | 'models';

export const TAB_ITEMS: Array<{ id: UsageTab; label: string }> = [
  { id: 'requestLogs', label: '请求日志' },
  { id: 'providers', label: 'Provider 统计' },
  { id: 'models', label: '模型统计' }
];

export function buildSvgPath(values: number[], max: number): string {
  if (values.length === 0) return 'M 0 42';
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 42 - (value / max) * 34;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function includesText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export function describeRange(range: GatewayUsageAnalyticsResponse['range']['preset']): string {
  if (range === '7d') return '近 7 天';
  if (range === '30d') return '近 30 天';
  if (range === '24h') return '近 24 小时';
  return '当天';
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function formatUsd(value: number, fractionDigits: number): string {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: 'currency'
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, style: 'percent' }).format(value);
}

export function compactThousands(value: number): string {
  return `${(value / 1000).toFixed(1)}k`;
}
