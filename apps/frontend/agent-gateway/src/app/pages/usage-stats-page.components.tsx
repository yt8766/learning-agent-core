import type { ReactNode } from 'react';
import type {
  GatewayUsageAnalyticsProviderStat,
  GatewayUsageAnalyticsRequestLog,
  GatewayUsageAnalyticsResponse
} from '@agent/core';
import { formatGatewayDate } from '../gateway-view-model';
import { buildSvgPath, describeRange, formatInteger, formatPercent, formatUsd } from './usage-stats-page.model';

interface SummaryCardProps {
  detail?: Array<[string, string]>;
  icon: ReactNode;
  label: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
  value: string;
}

export function SummaryCard({ detail = [], icon, label, tone, value }: SummaryCardProps) {
  return (
    <article className="usage-summary-card">
      <div className={`usage-summary-icon tone-${tone}`}>{icon}</div>
      <span className="usage-summary-label">{label}</span>
      <strong>{value}</strong>
      {detail.length > 0 ? (
        <dl>
          {detail.map(([name, itemValue]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{itemValue}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

export function TrendChart({ analytics }: { analytics: GatewayUsageAnalyticsResponse }) {
  const points = analytics.trend;
  const maxTokens = Math.max(...points.map(point => point.totalTokens), 1);
  const maxCost = Math.max(...points.map(point => point.estimatedCostUsd), 1);
  const inputPath = buildSvgPath(
    points.map(point => point.inputTokens),
    maxTokens
  );
  const outputPath = buildSvgPath(
    points.map(point => point.outputTokens),
    maxTokens
  );
  const cachePath = buildSvgPath(
    points.map(point => point.cacheHitTokens),
    maxTokens
  );
  const costPath = buildSvgPath(
    points.map(point => point.estimatedCostUsd),
    maxCost
  );
  return (
    <section className="usage-chart-card" aria-label="使用趋势">
      <div className="usage-chart-heading">
        <h2>使用趋势</h2>
        <span>{describeRange(analytics.range.preset)}</span>
      </div>
      <svg className="usage-trend-svg" viewBox="0 0 100 44" role="img" aria-label="Token 和成本趋势">
        <defs>
          <linearGradient id="usageTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[8, 18, 28, 38].map(y => (
          <line className="usage-chart-grid-line" key={y} x1="0" x2="100" y1={y} y2={y} />
        ))}
        <path className="usage-trend-fill" d={`${inputPath} L 100 42 L 0 42 Z`} />
        <path className="usage-trend-line usage-line-cost" d={costPath} />
        <path className="usage-trend-line usage-line-cache" d={cachePath} />
        <path className="usage-trend-line usage-line-input" d={inputPath} />
        <path className="usage-trend-line usage-line-output" d={outputPath} />
      </svg>
      <div className="usage-chart-axis">
        {points.slice(0, 6).map(point => (
          <span key={point.bucketStart}>{formatGatewayDate(point.bucketStart)}</span>
        ))}
      </div>
      <div className="usage-chart-legend">
        <span className="cost">成本</span>
        <span className="cache">缓存命中</span>
        <span className="input">输入</span>
        <span className="output">输出</span>
      </div>
    </section>
  );
}

export function RequestLogTable({ items }: { items: GatewayUsageAnalyticsRequestLog[] }) {
  return (
    <div className="usage-table-card">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>供应商</th>
            <th>计费模型</th>
            <th>输入</th>
            <th>输出</th>
            <th>总成本</th>
            <th>用时/首字</th>
            <th>状态</th>
            <th>来源</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{formatGatewayDate(item.occurredAt)}</td>
              <td>{item.providerName}</td>
              <td>{item.model ?? '-'}</td>
              <td>
                <strong>{formatInteger(item.inputTokens)}</strong>
                <small>R{formatInteger(item.cacheHitTokens)}</small>
              </td>
              <td>{formatInteger(item.outputTokens)}</td>
              <td>{formatUsd(item.estimatedCostUsd, 4)}</td>
              <td>{Math.round(item.latencyMs)}ms</td>
              <td
                className={item.statusCode >= 200 && item.statusCode < 400 ? 'usage-status-ok' : 'usage-status-error'}
              >
                {item.statusCode}
              </td>
              <td>{item.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 ? <div className="usage-empty">暂无请求日志</div> : null}
    </div>
  );
}

export function ProviderStatsTable({ items }: { items: GatewayUsageAnalyticsProviderStat[] }) {
  return (
    <div className="usage-table-card">
      <table>
        <thead>
          <tr>
            <th>供应商</th>
            <th>请求数</th>
            <th>Tokens</th>
            <th>成本</th>
            <th>成功率</th>
            <th>平均延迟</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.providerId}>
              <td>{item.providerName}</td>
              <td>{formatInteger(item.requestCount)}</td>
              <td>{formatInteger(item.totalTokens)}</td>
              <td>{formatUsd(item.estimatedCostUsd, 4)}</td>
              <td>{formatPercent(item.successRate)}</td>
              <td>{Math.round(item.averageLatencyMs)}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 ? <div className="usage-empty">暂无 Provider 统计</div> : null}
    </div>
  );
}

export function ModelStatsTable({ items }: { items: GatewayUsageAnalyticsResponse['modelStats'] }) {
  return (
    <div className="usage-table-card">
      <table>
        <thead>
          <tr>
            <th>模型</th>
            <th>请求数</th>
            <th>Tokens</th>
            <th>总成本</th>
            <th>平均成本</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={`${item.providerId ?? 'unknown'}:${item.model}`}>
              <td className="usage-model-cell">{item.model}</td>
              <td>{formatInteger(item.requestCount)}</td>
              <td>{formatInteger(item.totalTokens)}</td>
              <td>{formatUsd(item.estimatedCostUsd, 4)}</td>
              <td>{formatUsd(item.averageCostUsd, 6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 ? <div className="usage-empty">暂无模型统计</div> : null}
    </div>
  );
}
