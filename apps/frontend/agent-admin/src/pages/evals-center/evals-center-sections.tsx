import type { ChangeEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState, DashboardToolbar } from '@/components/dashboard-center-shell';

import type { EvalsCenterRecord } from '@/types/admin';

export function PromptRegressionSection({ evals }: { evals: EvalsCenterRecord }) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Prompt 回归</CardTitle>
        <Badge variant="outline">{evals.promptRegression?.promptSuiteCount ?? 0}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!evals.promptRegression ? (
          <DashboardEmptyState message="当前还没有可用的 prompt 回归配置概览。" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">套件 {evals.promptRegression.promptSuiteCount}</Badge>
              <Badge variant="secondary">Prompt {evals.promptRegression.promptCount}</Badge>
              <Badge variant="secondary">测试 {evals.promptRegression.testCount}</Badge>
              <Badge variant="secondary">Provider {evals.promptRegression.providerCount}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{evals.promptRegression.configPath}</p>
            {evals.promptRegression.updatedAt ? (
              <p className="text-xs text-muted-foreground">配置更新时间 {evals.promptRegression.updatedAt}</p>
            ) : null}
            {evals.promptRegression.latestRun ? (
              <article className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">最近一次 Prompt 运行</p>
                    <p className="mt-1 text-xs text-muted-foreground">{evals.promptRegression.latestRun.summaryPath}</p>
                  </div>
                  <Badge
                    variant={
                      evals.promptRegression.latestRun.overallStatus === 'pass'
                        ? 'success'
                        : evals.promptRegression.latestRun.overallStatus === 'partial'
                          ? 'warning'
                          : 'destructive'
                    }
                  >
                    {evals.promptRegression.latestRun.overallStatus === 'pass'
                      ? '通过'
                      : evals.promptRegression.latestRun.overallStatus === 'partial'
                        ? '部分通过'
                        : '失败'}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">{evals.promptRegression.latestRun.runAt}</Badge>
                  {typeof evals.promptRegression.latestRun.passRate === 'number' ? (
                    <Badge variant="secondary">通过率 {evals.promptRegression.latestRun.passRate}%</Badge>
                  ) : null}
                  {evals.promptRegression.latestRun.providerIds.map(providerId => (
                    <span key={providerId}>
                      <Badge variant="secondary">{providerId}</Badge>
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {evals.promptRegression.latestRun.suiteResults.map(result => (
                    <article key={result.suiteId} className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{result.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{result.suiteId}</p>
                        </div>
                        <Badge
                          variant={
                            result.status === 'pass'
                              ? 'success'
                              : result.status === 'partial'
                                ? 'warning'
                                : 'destructive'
                          }
                        >
                          {result.status === 'pass' ? '通过' : result.status === 'partial' ? '部分通过' : '失败'}
                        </Badge>
                      </div>
                      {typeof result.passRate === 'number' ? (
                        <p className="mt-2 text-xs text-muted-foreground">通过率 {result.passRate}%</p>
                      ) : null}
                      {result.notes?.length ? (
                        <p className="mt-2 text-xs text-muted-foreground">{result.notes.join('；')}</p>
                      ) : null}
                      {result.promptResults.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {result.promptResults.map(prompt => (
                            <span key={prompt.promptId}>
                              <Badge
                                variant={
                                  prompt.pass === true ? 'success' : prompt.pass === false ? 'destructive' : 'secondary'
                                }
                              >
                                {prompt.version}{' '}
                                {prompt.pass === true ? '通过' : prompt.pass === false ? '失败' : '未评估'}
                              </Badge>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </article>
            ) : (
              <p className="text-xs text-muted-foreground">当前还没有最近一次 prompt 回归结果摘要。</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {evals.promptRegression.suites.map(suite => (
                <article key={suite.suiteId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{suite.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{suite.suiteId}</p>
                    </div>
                    <Badge variant="outline">{suite.promptCount}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suite.versions.map(version => (
                      <span key={`${suite.suiteId}-${version}`}>
                        <Badge variant="secondary">{version}</Badge>
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface BenchmarkSectionsProps {
  evals: EvalsCenterRecord;
  scenarioFilter: string;
  onScenarioFilterChange: (value: string) => void;
  outcomeFilter: string;
  onOutcomeFilterChange: (value: string) => void;
}

export function BenchmarkSections({
  evals,
  scenarioFilter,
  onScenarioFilterChange,
  outcomeFilter,
  onOutcomeFilterChange
}: BenchmarkSectionsProps) {
  return (
    <>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">基准场景</CardTitle>
          <Badge variant="outline">{evals.scenarios.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DashboardToolbar title="基准筛选" description="按场景和结果筛选基准视图。">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                场景筛选
                <select
                  value={scenarioFilter}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => onScenarioFilterChange(event.target.value)}
                  className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">全部</option>
                  {evals.scenarios.map(scenario => (
                    <option key={scenario.scenarioId} value={scenario.scenarioId}>
                      {scenario.scenarioId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                结果筛选
                <select
                  value={outcomeFilter}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => onOutcomeFilterChange(event.target.value)}
                  className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">全部</option>
                  <option value="pass">通过</option>
                  <option value="fail">失败</option>
                </select>
              </label>
            </div>
          </DashboardToolbar>
          {evals.scenarios.map(scenario => (
            <article key={scenario.scenarioId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{scenario.label}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{scenario.description}</p>
                </div>
                <Badge
                  variant={scenario.passRate >= 70 ? 'success' : scenario.passRate >= 40 ? 'warning' : 'destructive'}
                >
                  {scenario.passRate}%
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>命中 {scenario.matchedRunCount}</span>
                <span>通过 {scenario.passCount}</span>
                <span>失败 {scenario.failCount}</span>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">近期基准运行</CardTitle>
          <Badge variant="outline">{evals.recentRuns.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {evals.recentRuns.length === 0 ? (
            <DashboardEmptyState message="当前还没有命中 benchmark 的运行记录。" />
          ) : (
            evals.recentRuns.map(run => (
              <article
                key={`${run.taskId}-${run.createdAt}`}
                className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{run.taskId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{run.createdAt}</p>
                  </div>
                  <Badge variant={run.success ? 'success' : 'destructive'}>{run.success ? '通过' : '失败'}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {run.scenarioIds.map(scenarioId => (
                    <span key={`${run.taskId}-${scenarioId}`}>
                      <Badge variant="secondary">{scenarioId}</Badge>
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
