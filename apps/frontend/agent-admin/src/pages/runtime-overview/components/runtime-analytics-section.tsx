import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';
import { LazyRuntimeAnalyticsCharts } from './lazy-runtime-analytics-charts';
import {
  buildCapacityData,
  buildModelDistributionData,
  buildProviderBillingTrendData,
  buildUsageTrendData,
  runtimeChartTabs,
  type RuntimeChartView
} from './runtime-analytics-support';

export function RuntimeAnalyticsSection({
  runtime,
  historyDays,
  onHistoryDaysChange
}: Pick<RuntimeOverviewPanelProps, 'runtime' | 'historyDays' | 'onHistoryDaysChange'>) {
  const [activeChart, setActiveChart] = useState<RuntimeChartView>('area');

  const usageHistory = runtime.usageAnalytics.persistedDailyHistory?.length
    ? runtime.usageAnalytics.persistedDailyHistory
    : runtime.usageAnalytics.daily;
  const chartMeta = runtimeChartTabs.find(item => item.id === activeChart) ?? runtimeChartTabs[0];

  const usageTrendData = useMemo(() => buildUsageTrendData(usageHistory), [usageHistory]);

  const modelDistributionData = useMemo(
    () => buildModelDistributionData(runtime.usageAnalytics.models),
    [runtime.usageAnalytics.models]
  );

  const providerBillingTrendData = useMemo(
    () => buildProviderBillingTrendData(runtime.usageAnalytics.providerBillingDailyHistory ?? []),
    [runtime.usageAnalytics.providerBillingDailyHistory]
  );

  const capacityData = useMemo(() => buildCapacityData(runtime), [runtime]);

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

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="gap-4 border-b border-[#ecece8] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold text-foreground">{chartMeta.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{chartMeta.description}</p>
            </div>
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
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {runtimeChartTabs.map(item => (
              <Button
                key={item.id}
                size="sm"
                variant={activeChart === item.id ? 'default' : 'ghost'}
                onClick={() => setActiveChart(item.id)}
              >
                {item.label}
              </Button>
            ))}
            <Badge variant="outline">
              当前 {runtime.usageAnalytics.daily.length} 天 / 持久化{' '}
              {runtime.usageAnalytics.historyDays ?? usageHistory.length} 天
            </Badge>
          </div>
          {runtime.usageAnalytics.historyRange ? (
            <p className="text-xs text-muted-foreground">
              归档范围 {runtime.usageAnalytics.historyRange.earliestDay} -{' '}
              {runtime.usageAnalytics.historyRange.latestDay}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="pt-5">
          <LazyRuntimeAnalyticsCharts
            activeChart={activeChart}
            usageTrendData={usageTrendData}
            modelDistributionData={modelDistributionData}
            providerBillingTrendData={providerBillingTrendData}
            capacityData={capacityData}
          />
        </CardContent>
      </Card>

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
