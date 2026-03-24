import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';

export function RuntimeSummarySection({ runtime }: Pick<RuntimeOverviewPanelProps, 'runtime'>) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '活跃任务', value: runtime.activeTaskCount, detail: `总任务 ${runtime.taskCount}` },
          {
            label: '队列深度',
            value: runtime.queueDepth,
            detail: `阻塞 ${runtime.blockedRunCount} / 预算耗尽 ${runtime.budgetExceededCount ?? 0}`
          },
          {
            label: '待审批',
            value: runtime.pendingApprovalCount,
            detail: `会话 ${runtime.activeSessionCount}/${runtime.sessionCount}`
          },
          {
            label: '活跃尚书',
            value: runtime.activeMinistries.length,
            detail: runtime.activeWorkers.join(' / ') || '暂无'
          }
        ].map(card => (
          <Card key={card.label} className="rounded-3xl border-stone-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-stone-500">{card.label}</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">{card.value}</p>
              <p className="mt-3 text-sm text-stone-500">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
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
        ].map(card => (
          <Card key={card.label} className="rounded-3xl border-stone-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-stone-500">{card.label}</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">{card.value}</p>
              <p className="mt-3 text-sm text-stone-500">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-stone-950">Budget Policy & Alerts</CardTitle>
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
            {runtime.usageAnalytics.alerts.map((alert, index) => (
              <article
                key={`${alert.title}-${index}`}
                className={`rounded-2xl border px-4 py-4 ${
                  alert.level === 'critical'
                    ? 'border-red-200 bg-red-50'
                    : alert.level === 'warning'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-emerald-200 bg-emerald-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{alert.title}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">{alert.description}</p>
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
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
