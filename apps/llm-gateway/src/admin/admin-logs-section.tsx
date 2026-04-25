'use client';

import type { AdminDashboardResponse, AdminRequestLogEntry } from '../contracts/admin-logs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export interface AdminOperationsData {
  dashboard: AdminDashboardResponse;
  logs: AdminRequestLogEntry[];
}

export function LogsSection({ operations }: { operations: AdminOperationsData }) {
  return (
    <section className="mt-4 grid gap-4" aria-labelledby="cost-logs-title">
      <div className="grid grid-cols-4 gap-3 max-[820px]:grid-cols-2 max-[460px]:grid-cols-1">
        <OperationMetric label="请求数" value={operations.dashboard.summary.requestCount.toLocaleString()} />
        <OperationMetric label="Token 总量" value={operations.dashboard.summary.totalTokens.toLocaleString()} />
        <OperationMetric label="成本" value={formatCost(operations.dashboard.summary.estimatedCost)} />
        <OperationMetric label="失败率" value={formatPercent(operations.dashboard.summary.failureRate)} />
      </div>

      <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        <RollupCard
          title="热门模型"
          rows={operations.dashboard.topModels.map(item => ({
            name: item.model,
            value: `${item.requestCount} 次 · ${formatCost(item.estimatedCost)}`
          }))}
        />
        <RollupCard
          title="热门凭证"
          rows={operations.dashboard.topKeys.map(item => ({
            name: item.keyId,
            value: `${item.requestCount} 次 · ${item.totalTokens.toLocaleString()} token`
          }))}
        />
        <RollupCard
          title="热门服务商"
          rows={operations.dashboard.topProviders.map(item => ({
            name: item.provider,
            value: `${item.requestCount} 次 · ${formatCost(item.estimatedCost)}`
          }))}
        />
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle id="cost-logs-title" className="text-base">
            成本与日志
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-4 pt-0">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">时间</th>
                <th className="py-2 pr-3">凭证</th>
                <th className="py-2 pr-3">模型</th>
                <th className="py-2 pr-3">服务商</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">Token</th>
                <th className="py-2 pr-3">成本</th>
                <th className="py-2 pr-3">延迟</th>
                <th className="py-2 pr-3">错误</th>
              </tr>
            </thead>
            <tbody>
              {operations.logs.map(log => (
                <tr className="border-t border-border" key={log.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatTime(log.createdAt)}</td>
                  <td className="max-w-[160px] truncate py-2 pr-3 font-mono text-xs">{log.keyId}</td>
                  <td className="max-w-[180px] truncate py-2 pr-3 font-medium">{log.model}</td>
                  <td className="py-2 pr-3">{log.provider}</td>
                  <td className="py-2 pr-3">{formatStatus(log.status)}</td>
                  <td className="py-2 pr-3">{log.totalTokens.toLocaleString()}</td>
                  <td className="py-2 pr-3">{formatCost(log.estimatedCost)}</td>
                  <td className="py-2 pr-3">{log.latencyMs} ms</td>
                  <td className="max-w-[220px] truncate py-2 pr-3">{log.errorMessage ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {operations.logs.length === 0 ? <p className="py-8 text-sm text-muted-foreground">暂无请求日志</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function OperationMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-h-[92px]">
      <CardHeader className="p-4 pb-1">
        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <strong className="block truncate text-2xl font-semibold leading-tight text-foreground">{value}</strong>
      </CardContent>
    </Card>
  );
}

function RollupCard({ title, rows }: { title: string; rows: Array<{ name: string; value: string }> }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid gap-2">
          {rows.map(row => (
            <div className="flex items-center justify-between gap-3 text-sm" key={row.name}>
              <span className="min-w-0 truncate font-medium text-foreground">{row.name}</span>
              <span className="shrink-0 text-muted-foreground">{row.value}</span>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">暂无数据</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function formatCost(value: number): string {
  return `$${value.toFixed(6)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    success: '成功',
    error: '错误',
    timeout: '超时'
  };
  return labels[status] ?? status;
}

function formatTime(value: string): string {
  return new Date(value).toISOString().slice(0, 16).replace('T', ' ');
}
