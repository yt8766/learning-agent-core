import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';

export function RuntimeAnalyticsSection({
  runtime,
  historyDays,
  onHistoryDaysChange
}: Pick<RuntimeOverviewPanelProps, 'runtime' | 'historyDays' | 'onHistoryDaysChange'>) {
  const usageHistory = runtime.usageAnalytics.persistedDailyHistory?.length
    ? runtime.usageAnalytics.persistedDailyHistory
    : runtime.usageAnalytics.daily;
  const maxDailyTokens = Math.max(1, ...usageHistory.map(item => item.tokens));
  const maxModelTokens = Math.max(1, ...runtime.usageAnalytics.models.map(item => item.tokens));

  return (
    <>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Provider Billing Audit</CardTitle>
          <Badge variant="outline">{runtime.usageAnalytics.providerBillingStatus?.status ?? 'disabled'}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Provider {runtime.usageAnalytics.providerBillingStatus?.provider ?? 'unknown'} / 来源{' '}
            {runtime.usageAnalytics.providerBillingStatus?.source ?? 'unconfigured'} /
            {runtime.usageAnalytics.providerBillingStatus?.syncedAt
              ? ` 最近同步 ${runtime.usageAnalytics.providerBillingStatus.syncedAt}`
              : ' 尚未同步'}
          </p>
          {runtime.usageAnalytics.providerBillingStatus?.message ? (
            <p className="text-sm text-muted-foreground">{runtime.usageAnalytics.providerBillingStatus.message}</p>
          ) : null}
          {runtime.usageAnalytics.providerBillingTotals ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {runtime.usageAnalytics.providerBillingTotals.totalTokens.toLocaleString()} tokens
              </Badge>
              <Badge variant="secondary">¥{runtime.usageAnalytics.providerBillingTotals.costCny.toFixed(2)}</Badge>
              <Badge variant="secondary">{runtime.usageAnalytics.providerBillingTotals.runs} runs</Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Daily Token / Cost</CardTitle>
            <div className="flex items-center gap-2">
              {[7, 30, 90].map(option => (
                <Button
                  key={option}
                  size="sm"
                  variant={historyDays === option ? 'default' : 'outline'}
                  onClick={() => onHistoryDaysChange(option)}
                >
                  {option}d
                </Button>
              ))}
              <Badge variant="outline">
                当前 {runtime.usageAnalytics.daily.length} 天 / 持久化{' '}
                {runtime.usageAnalytics.historyDays ?? usageHistory.length} 天
              </Badge>
            </div>
          </CardHeader>
          {runtime.usageAnalytics.historyRange ? (
            <p className="px-6 text-xs text-muted-foreground">
              归档范围 {runtime.usageAnalytics.historyRange.earliestDay} -{' '}
              {runtime.usageAnalytics.historyRange.latestDay}
            </p>
          ) : null}
          <CardContent className="grid gap-3">
            {usageHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">当前没有可用的 usage 历史。</p>
            ) : (
              usageHistory.map(item => (
                <article key={item.day} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.day}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.runs} runs / {item.tokens.toLocaleString()} tokens / ¥{item.costCny.toFixed(2)}
                      </p>
                    </div>
                    <Badge variant={item.overBudget ? 'warning' : 'outline'}>{item.tokens.toLocaleString()}</Badge>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${Math.max(6, Math.round((item.tokens / maxDailyTokens) * 100))}%` }}
                    />
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Model Cost Distribution</CardTitle>
            <Badge variant="outline">{runtime.usageAnalytics.models.length} models</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {runtime.usageAnalytics.models.length === 0 ? (
              <p className="text-sm text-muted-foreground">当前还没有模型用量记录。</p>
            ) : (
              runtime.usageAnalytics.models.map(item => (
                <article key={item.model} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.model}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.runCount} allocations / {item.tokens.toLocaleString()} tokens / ¥{item.costCny.toFixed(2)}
                      </p>
                    </div>
                    <Badge variant="outline">${item.costUsd.toFixed(4)}</Badge>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${Math.max(6, Math.round((item.tokens / maxModelTokens) * 100))}%` }}
                    />
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Usage Audit</CardTitle>
          <Badge variant="outline">{runtime.usageAnalytics.recentUsageAudit?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {runtime.usageAnalytics.recentUsageAudit?.length ? (
            runtime.usageAnalytics.recentUsageAudit.map(item => (
              <article
                key={`${item.taskId}-${item.updatedAt}`}
                className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.taskId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.day} / {item.updatedAt}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {item.totalTokens.toLocaleString()} tokens / ¥{item.totalCostCny.toFixed(2)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.modelBreakdown.map(model => (
                    <span key={`${item.taskId}-${model.model}`}>
                      <Badge variant="secondary">
                        {model.model} / {model.pricingSource ?? 'estimated'}
                      </Badge>
                    </span>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">当前还没有可用的 usage 审计记录。</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
