import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardMetricGrid } from '@/components/dashboard-center-shell';

import type { RuntimeSummarySectionProps } from './runtime-summary-types';

export function RuntimeSummaryBudget({ runtime }: Pick<RuntimeSummarySectionProps, 'runtime'>) {
  return (
    <>
      <DashboardMetricGrid
        columns="md:grid-cols-2 xl:grid-cols-5"
        items={[
          {
            label: '估算 Prompt Tokens',
            value: runtime.usageAnalytics.totalEstimatedPromptTokens.toLocaleString(),
            detail: '基于任务输入与引用证据文本估算'
          },
          {
            label: '估算 Completion Tokens',
            value: runtime.usageAnalytics.totalEstimatedCompletionTokens.toLocaleString(),
            detail: '基于结果、trace 与内部消息文本估算'
          },
          {
            label: '估算总 Tokens',
            value: runtime.usageAnalytics.totalEstimatedTokens.toLocaleString(),
            detail: `实测 ${runtime.usageAnalytics.measuredRunCount} runs / 估算 ${runtime.usageAnalytics.estimatedRunCount} runs`
          },
          {
            label: '估算费用',
            value: `¥${runtime.usageAnalytics.totalEstimatedCostCny.toFixed(2)}`,
            detail: `$${runtime.usageAnalytics.totalEstimatedCostUsd.toFixed(4)} / 基于内部模型费率映射`
          },
          {
            label: '真实/估算费用',
            value: `¥${runtime.usageAnalytics.providerMeasuredCostCny.toFixed(2)} / ¥${runtime.usageAnalytics.estimatedFallbackCostCny.toFixed(2)}`,
            detail: 'provider 实测 / fallback 估算'
          }
        ].map(card => ({ label: card.label, value: card.value, note: card.detail }))}
      />

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Budget Policy & Alerts</CardTitle>
          <Badge variant="outline">{runtime.usageAnalytics.alerts.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              日 token 阈值 {runtime.usageAnalytics.budgetPolicy.dailyTokenWarning.toLocaleString()}
            </Badge>
            <Badge variant="secondary">
              日费用阈值 ¥{runtime.usageAnalytics.budgetPolicy.dailyCostCnyWarning.toFixed(2)}
            </Badge>
            <Badge variant="secondary">
              累计费用阈值 ¥{runtime.usageAnalytics.budgetPolicy.totalCostCnyWarning.toFixed(2)}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {runtime.usageAnalytics.alerts.length === 0 ? (
              <Card className="border-dashed border-border/70 bg-muted/20 shadow-none md:col-span-2">
                <CardContent className="p-6 text-sm text-muted-foreground">当前没有预算预警。</CardContent>
              </Card>
            ) : (
              runtime.usageAnalytics.alerts.map((alert, index) => (
                <article
                  key={`${alert.title}-${index}`}
                  className={`rounded-2xl border px-4 py-4 ${
                    alert.level === 'critical'
                      ? 'border-red-200/70 bg-red-50/80'
                      : alert.level === 'warning'
                        ? 'border-amber-200/70 bg-amber-50/80'
                        : 'border-emerald-200/70 bg-emerald-50/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.description}</p>
                    </div>
                    <Badge
                      variant={
                        alert.level === 'critical' ? 'destructive' : alert.level === 'warning' ? 'warning' : 'success'
                      }
                    >
                      {alert.level}
                    </Badge>
                  </div>
                </article>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
