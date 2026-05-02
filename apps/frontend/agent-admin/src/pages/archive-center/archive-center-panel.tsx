import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardCenterShell } from '@/components/dashboard-center-shell';

import type { EvalsCenterRecord, RuntimeCenterRecord } from '@/types/admin';
import { getExecutionModeDisplayName } from '@/lib/runtime-semantics';

interface ArchiveCenterPanelProps {
  runtime: RuntimeCenterRecord;
  evals: EvalsCenterRecord;
  runtimeHistoryDays: number;
  evalsHistoryDays: number;
  runtimeExportFilters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    executionMode?: string;
    interactionKind?: string;
  };
  approvalsExportFilters?: {
    executionMode?: string;
    interactionKind?: string;
  };
  onRuntimeHistoryDaysChange: (days: number) => void;
  onEvalsHistoryDaysChange: (days: number) => void;
  onExportRuntime: () => void;
  onExportApprovals: () => void;
  onExportEvals: () => void;
}

export function ArchiveCenterPanel(props: ArchiveCenterPanelProps) {
  const usageHistory = props.runtime.usageAnalytics.persistedDailyHistory ?? [];
  const evalHistory = props.evals.persistedDailyHistory ?? [];
  const recentUsageAudit = props.runtime.usageAnalytics.recentUsageAudit ?? [];
  const recentEvalRuns = props.evals.recentRuns ?? [];

  return (
    <DashboardCenterShell
      title="归档中心"
      description="统一导出 runtime、approvals 与 evals 历史，并回放归档摘要。"
      actions={<Badge variant="secondary">导出归档</Badge>}
    >
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground">运行归档</CardTitle>
              <Button type="button" size="sm" onClick={props.onExportRuntime}>
                导出运行数据
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">归档天数 {props.runtime.usageAnalytics.historyDays ?? 0}</Badge>
                {props.runtime.usageAnalytics.historyRange ? (
                  <Badge variant="secondary">
                    {props.runtime.usageAnalytics.historyRange.earliestDay} -{' '}
                    {props.runtime.usageAnalytics.historyRange.latestDay}
                  </Badge>
                ) : null}
                {[7, 30, 90].map(days => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant={props.runtimeHistoryDays === days ? 'default' : 'secondary'}
                    onClick={() => props.onRuntimeHistoryDaysChange(days)}
                  >
                    {days}d
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">状态 {props.runtimeExportFilters?.status || '全部'}</Badge>
                <Badge variant="outline">模型 {props.runtimeExportFilters?.model || '全部'}</Badge>
                <Badge variant="outline">计费 {props.runtimeExportFilters?.pricingSource || '全部'}</Badge>
                <Badge variant="outline">
                  执行模式 {getExecutionModeDisplayName(props.runtimeExportFilters?.executionMode) || '全部'}
                </Badge>
                <Badge variant="outline">交互类型 {props.runtimeExportFilters?.interactionKind || '全部'}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                运行归档会沿用当前运行视图中的筛选条件，便于按计划模式或计划提问视角回放历史。
              </p>
              <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">审批归档</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      审批导出与审批中枢当前筛选保持一致，便于单独回放计划提问与操作确认。
                    </p>
                  </div>
                  <Button type="button" size="sm" onClick={props.onExportApprovals}>
                    导出审批
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    执行模式 {getExecutionModeDisplayName(props.approvalsExportFilters?.executionMode) || '全部'}
                  </Badge>
                  <Badge variant="outline">交互类型 {props.approvalsExportFilters?.interactionKind || '全部'}</Badge>
                </div>
              </div>
              {usageHistory
                .slice(-10)
                .reverse()
                .map(point => (
                  <article key={point.day} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm text-foreground">{point.day}</strong>
                      <Badge variant={point.overBudget ? 'warning' : 'outline'}>
                        {point.tokens.toLocaleString()} tokens
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {point.runs} runs · ¥{point.costCny.toFixed(2)} · 实测 {point.measuredRunCount ?? 0} / 估算{' '}
                      {point.estimatedRunCount ?? 0}
                    </p>
                  </article>
                ))}
              <div className="grid gap-3 pt-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">近期用量审计</p>
                {recentUsageAudit.slice(0, 5).map(item => (
                  <article
                    key={`${item.taskId}-${item.updatedAt}`}
                    className="rounded-2xl border border-border/70 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm text-foreground">{item.taskId}</strong>
                      <Badge variant="outline">{item.totalTokens.toLocaleString()} tokens</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.day} · ¥{item.totalCostCny.toFixed(2)} · 实测 {item.measuredCallCount} / 估算{' '}
                      {item.estimatedCallCount}
                    </p>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground">评测归档</CardTitle>
              <Button type="button" size="sm" onClick={props.onExportEvals}>
                导出评测
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">归档天数 {props.evals.historyDays ?? 0}</Badge>
                {props.evals.historyRange ? (
                  <Badge variant="secondary">
                    {props.evals.historyRange.earliestDay} - {props.evals.historyRange.latestDay}
                  </Badge>
                ) : null}
                {[7, 30, 90].map(days => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant={props.evalsHistoryDays === days ? 'default' : 'secondary'}
                    onClick={() => props.onEvalsHistoryDaysChange(days)}
                  >
                    {days}天
                  </Button>
                ))}
              </div>
              {evalHistory
                .slice(-10)
                .reverse()
                .map(point => (
                  <article key={point.day} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm text-foreground">{point.day}</strong>
                      <Badge
                        variant={point.passRate >= 70 ? 'success' : point.passRate >= 40 ? 'warning' : 'destructive'}
                      >
                        {point.passRate}%
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      运行 {point.runCount} · 通过 {point.passCount} · 场景 {point.scenarioCount}
                    </p>
                  </article>
                ))}
              <div className="grid gap-3 pt-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">近期评测运行</p>
                {recentEvalRuns.slice(0, 5).map(run => (
                  <article
                    key={`${run.taskId}-${run.createdAt}`}
                    className="rounded-2xl border border-border/70 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm text-foreground">{run.taskId}</strong>
                      <Badge variant={run.success ? 'success' : 'destructive'}>{run.success ? '通过' : '失败'}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {run.createdAt} · {run.scenarioIds.join(', ')}
                    </p>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardCenterShell>
  );
}
