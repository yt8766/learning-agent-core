import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState, DashboardToolbar } from '@/components/dashboard-center-shell';

import type { RuntimeSummarySectionProps } from './runtime-summary-types';

interface RuntimeSummaryAgentErrorsProps extends Pick<
  RuntimeSummarySectionProps,
  'runtime' | 'onSelectTask' | 'onRetryTask' | 'onRefreshRuntime' | 'onCreateDiagnosisTask'
> {
  errorCodeFilter: string;
  ministryFilter: string;
  retryableFilter: string;
  errorCodeOptions: string[];
  ministryOptions: string[];
  filteredAgentErrors: NonNullable<RuntimeSummarySectionProps['runtime']['recentAgentErrors']>;
  onErrorCodeFilterChange: (value: string) => void;
  onMinistryFilterChange: (value: string) => void;
  onRetryableFilterChange: (value: string) => void;
}

export function RuntimeSummaryAgentErrors({
  runtime,
  onSelectTask,
  onRetryTask,
  onRefreshRuntime,
  onCreateDiagnosisTask,
  errorCodeFilter,
  ministryFilter,
  retryableFilter,
  errorCodeOptions,
  ministryOptions,
  filteredAgentErrors,
  onErrorCodeFilterChange,
  onMinistryFilterChange,
  onRetryableFilterChange
}: RuntimeSummaryAgentErrorsProps) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Recent Agent Errors</CardTitle>
        <Badge variant="outline">{filteredAgentErrors.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {(runtime.diagnosisEvidenceCount ?? 0) > 0 ? (
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-950">
            <p className="font-semibold">Diagnosis Evidence Ready</p>
            <p className="mt-1">
              当前已有 {runtime.diagnosisEvidenceCount} 条诊断结论沉淀，可在 Evidence Center 查看
              <code className="mx-1 rounded bg-emerald-100 px-1 py-0.5 text-[11px]">diagnosis_result</code>
              记录。
            </p>
          </div>
        ) : null}

        <DashboardToolbar title="Error Filters" description="按 error code、部属与是否可重试收窄错误列表。">
          <div className="grid gap-3 md:grid-cols-3">
            <FilterSelect
              label="Error Code"
              value={errorCodeFilter}
              options={errorCodeOptions}
              onChange={event => onErrorCodeFilterChange(event.target.value)}
            />
            <FilterSelect
              label="Ministry"
              value={ministryFilter}
              options={ministryOptions}
              onChange={event => onMinistryFilterChange(event.target.value)}
            />
            <label className="grid gap-1 text-xs text-muted-foreground">
              Retryability
              <select
                value={retryableFilter}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onRetryableFilterChange(event.target.value)}
                className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">全部</option>
                <option value="retryable">retryable</option>
                <option value="fatal">fatal</option>
              </select>
            </label>
          </div>
        </DashboardToolbar>

        {filteredAgentErrors.length === 0 ? (
          <DashboardEmptyState message="当前没有最近的 agent 级错误。" />
        ) : (
          filteredAgentErrors.map(item => (
            <article key={item.id} className="rounded-2xl border border-red-200/70 bg-red-50/70 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.taskId} / {item.goal}
                  </p>
                </div>
                <Badge variant={item.retryable ? 'warning' : 'destructive'}>
                  {item.retryable ? 'retryable' : 'fatal'}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{item.errorCode}</Badge>
                <Badge variant="secondary">{item.errorCategory}</Badge>
                <Badge variant="outline">诊断建议已就绪</Badge>
                {item.ministry ? <Badge variant="outline">{item.ministry}</Badge> : null}
                {item.node ? <Badge variant="outline">{item.node}</Badge> : null}
                {item.toolName ? <Badge variant="outline">{item.toolName}</Badge> : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(item.at).toLocaleString()}</p>
              {item.diagnosisHint ? (
                <InfoBlock title="Diagnosis Hint" tone="amber">
                  {item.diagnosisHint}
                </InfoBlock>
              ) : null}
              {item.recommendedAction ? (
                <InfoBlock title="Recommended Action" tone="blue">
                  {item.recommendedAction}
                </InfoBlock>
              ) : null}
              {item.recoveryPlaybook?.length ? (
                <InfoBlock title="Recovery Playbook" tone="emerald">
                  <div className="mt-2 grid gap-1">
                    {item.recoveryPlaybook.map(step => (
                      <p key={`${item.id}-${step}`}>{step}</p>
                    ))}
                  </div>
                </InfoBlock>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton onClick={() => void onSelectTask(item.taskId)}>查看任务</ActionButton>
                <ActionButton tone="red" onClick={() => void onRetryTask(item.taskId)}>
                  重试任务
                </ActionButton>
                <ActionButton tone="blue" onClick={() => void onRefreshRuntime()}>
                  刷新运行态
                </ActionButton>
                <ActionButton
                  tone="emerald"
                  onClick={() =>
                    void onCreateDiagnosisTask({
                      taskId: item.taskId,
                      goal: item.goal,
                      errorCode: item.errorCode,
                      ministry: item.ministry,
                      message: item.message,
                      diagnosisHint: item.diagnosisHint,
                      recommendedAction: item.recommendedAction,
                      stack: item.stack,
                      recoveryPlaybook: item.recoveryPlaybook
                    })
                  }
                >
                  创建诊断任务
                </ActionButton>
              </div>
              {item.stack ? (
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-background px-3 py-3 text-[11px] text-foreground">
                  {item.stack}
                </pre>
              ) : null}
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function FilterSelect(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {props.label}
      <select
        value={props.value}
        onChange={props.onChange}
        className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="">全部</option>
        {props.options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoBlock(props: { title: string; tone: 'amber' | 'blue' | 'emerald'; children: React.ReactNode }) {
  const toneClass =
    props.tone === 'amber'
      ? 'mt-3 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-3 text-sm text-amber-950'
      : props.tone === 'blue'
        ? 'mt-3 rounded-xl border border-blue-200/70 bg-blue-50/80 px-3 py-3 text-sm text-blue-950'
        : 'mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-3 text-sm text-emerald-950';
  return (
    <div className={toneClass}>
      <p className="font-medium">{props.title}</p>
      <div className="mt-1">{props.children}</div>
    </div>
  );
}

function ActionButton(props: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'stone' | 'red' | 'blue' | 'emerald';
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={
        props.tone === 'red'
          ? 'destructive'
          : props.tone === 'blue'
            ? 'default'
            : props.tone === 'emerald'
              ? 'secondary'
              : 'outline'
      }
      onClick={props.onClick}
    >
      {props.children}
    </Button>
  );
}
