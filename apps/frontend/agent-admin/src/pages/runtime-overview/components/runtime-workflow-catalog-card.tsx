import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

import type { WorkflowPresetDefinition } from '@agent/core';

import { getWorkflowPresets, isAbortedAdminRequestError } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RuntimeWorkflowExecutionMapCard } from './runtime-workflow-execution-map-card';
import { buildWorkflowLaunchGoal } from './runtime-workflow-catalog-support';

export function RuntimeWorkflowCatalogCard(props: {
  onLaunchWorkflowTask: (params: { goal: string; workflowCommand?: string }) => void | Promise<void>;
}) {
  const [workflows, setWorkflows] = useState<WorkflowPresetDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void getWorkflowPresets()
      .then(next => {
        if (cancelled) {
          return;
        }
        setWorkflows(next);
        setSelectedWorkflowId(current => current || next[0]?.id || '');
      })
      .catch(loadError => {
        if (cancelled || isAbortedAdminRequestError(loadError)) {
          return;
        }
        setWorkflows([]);
        setError(loadError instanceof Error ? loadError.message : '加载 workflow catalog 失败。');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedWorkflow = useMemo(
    () => workflows.find(item => item.id === selectedWorkflowId) ?? workflows[0],
    [workflows, selectedWorkflowId]
  );
  const launchPreview = selectedWorkflow ? buildWorkflowLaunchGoal(selectedWorkflow, goal) : '';

  const handleLaunch = async () => {
    if (!selectedWorkflow || !goal.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      await props.onLaunchWorkflowTask({
        goal,
        workflowCommand: selectedWorkflow.command
      });
      setGoal('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground">Workflow Catalog</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            选择一个流程，输入目标后直接发起运行并接入 observability。
          </p>
        </div>
        <Badge variant="outline">{workflows.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="grid gap-3">
            {loading ? <p className="text-sm text-muted-foreground">正在加载 workflow catalog...</p> : null}
            {error ? <p className="text-sm text-destructive">workflow catalog 加载失败：{error}</p> : null}
            {workflows.map(workflow => (
              <button
                key={workflow.id}
                type="button"
                onClick={() => setSelectedWorkflowId(workflow.id)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  selectedWorkflow?.id === workflow.id
                    ? 'border-emerald-500 bg-emerald-50/70'
                    : 'border-border/70 bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{workflow.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {workflow.command ?? 'no command'} / {workflow.id}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{workflow.approvalPolicy}</Badge>
                    <Badge variant="outline">{workflow.outputContract.type}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {workflow.requiredMinistries.map(ministry => (
                    <span key={`${workflow.id}-${ministry}`}>
                      <Badge variant="outline">{ministry}</Badge>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {workflow.outputContract.requiredSections.map(section => (
                    <span key={`${workflow.id}-${section}`}>
                      <Badge variant="secondary">{section}</Badge>
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <label className="grid gap-1 text-xs text-muted-foreground">
              流程
              <select
                value={selectedWorkflow?.id ?? ''}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedWorkflowId(event.target.value)}
                className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                {workflows.map(workflow => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              输入目标
              <textarea
                value={goal}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setGoal(event.target.value)}
                rows={6}
                placeholder={
                  selectedWorkflow?.command
                    ? `例如：${selectedWorkflow.command} audit runtime pipeline`
                    : '输入执行目标'
                }
                className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
              <p className="text-xs text-muted-foreground">Launch Preview</p>
              <p className="mt-1 break-all text-sm text-foreground">
                {launchPreview || '选择流程并输入目标后，这里会展示实际提交内容。'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void handleLaunch()}
                disabled={!selectedWorkflow || !goal.trim() || submitting}
              >
                {submitting ? '启动中...' : '启动流程'}
              </Button>
              {selectedWorkflow?.webLearningPolicy ? (
                <Badge variant="outline">source {selectedWorkflow.sourcePolicy?.mode ?? 'controlled-first'}</Badge>
              ) : null}
            </div>
          </div>
        </div>
        {selectedWorkflow ? (
          <RuntimeWorkflowExecutionMapCard
            workflow={selectedWorkflow}
            title="Workflow Blueprint"
            emptyMessage="选择 workflow 后，这里会显示流程骨架。"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
