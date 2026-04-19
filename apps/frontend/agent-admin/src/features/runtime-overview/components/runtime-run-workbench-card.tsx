import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';

import type { RunBundleRecord } from '@agent/core';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { RunObservatoryFocusTarget } from '@/features/run-observatory/run-observatory-panel-support';
import type { TaskBundle } from '@/types/admin';

import { type AgentGraphOverlayFilter } from './runtime-agent-graph-overlay-support';
import {
  buildCurrentNodeSlice,
  buildReplayGoal,
  inferWorkflowCommand,
  resolveGraphFilterForWorkbenchTarget,
  stripWorkflowCommand,
  uniqueValues,
  type RuntimeReplayLaunchReceipt,
  type RuntimeRunWorkbenchReplayDraftSeed
} from './runtime-run-workbench-support';

export function RuntimeRunWorkbenchCard(props: {
  bundle: TaskBundle;
  detail?: RunBundleRecord | null;
  focusTarget?: RunObservatoryFocusTarget;
  graphFilter?: AgentGraphOverlayFilter;
  compareTaskId?: string;
  baselineRun?: RunBundleRecord['run'];
  replayDraftSeed?: RuntimeRunWorkbenchReplayDraftSeed;
  replayLaunchReceipt?: RuntimeReplayLaunchReceipt;
  onRetryTask: () => void;
  onRerunFromSnapshot?: (params: {
    goal: string;
    workflowCommand?: string;
    baselineTaskId?: string;
    replaySourceLabel?: string;
    replayScoped?: boolean;
  }) => void;
  onFocusTargetChange: (target: RunObservatoryFocusTarget) => void;
  onGraphFilterChange?: (filter?: AgentGraphOverlayFilter) => void;
  onClearGraphFilter: () => void;
  onClearCompare: () => void;
}) {
  const workflow = props.bundle.task.resolvedWorkflow;
  const currentStage = props.detail?.run.currentStage ?? props.bundle.task.currentExecutionStep?.stage;
  const currentNode = props.detail?.run.currentNode ?? props.bundle.task.currentNode ?? props.bundle.task.currentWorker;
  const workflowCommand = inferWorkflowCommand(props.bundle.task.goal);
  const inputGoal = stripWorkflowCommand(props.bundle.task.goal, workflowCommand);
  const currentNodeSlice = buildCurrentNodeSlice(props.detail, currentNode, currentStage);
  const [replayCommandDraft, setReplayCommandDraft] = useState(
    () => props.replayDraftSeed?.workflowCommand ?? workflowCommand ?? ''
  );
  const [replayGoalDraft, setReplayGoalDraft] = useState(() => props.replayDraftSeed?.goal ?? inputGoal);
  const [activeReplayScopeSeed, setActiveReplayScopeSeed] = useState<RuntimeRunWorkbenchReplayDraftSeed | undefined>(
    () => props.replayDraftSeed
  );

  useEffect(() => {
    setReplayCommandDraft(workflowCommand ?? '');
    setReplayGoalDraft(inputGoal);
    setActiveReplayScopeSeed(undefined);
  }, [workflowCommand, inputGoal, props.bundle.task.id]);

  useEffect(() => {
    if (!props.replayDraftSeed) {
      return;
    }
    setReplayCommandDraft(props.replayDraftSeed.workflowCommand ?? '');
    setReplayGoalDraft(props.replayDraftSeed.goal);
    setActiveReplayScopeSeed(props.replayDraftSeed);
  }, [props.replayDraftSeed]);

  const snapshotGoal = buildReplayGoal(workflowCommand ?? '', inputGoal);
  const replayDraftGoal = buildReplayGoal(replayCommandDraft, replayGoalDraft);
  const commandChanged = (workflowCommand ?? '') !== replayCommandDraft.trim();
  const inputChanged = inputGoal !== replayGoalDraft;
  const predictedStages = uniqueValues([
    commandChanged ? 'plan' : undefined,
    commandChanged ? 'route' : undefined,
    currentStage,
    ...(props.graphFilter?.stages ?? [])
  ]).slice(0, 4);
  const predictedNodes = uniqueValues([
    currentNode,
    props.bundle.task.currentMinistry,
    props.graphFilter?.label,
    ...(activeReplayScopeSeed?.scopeChips
      .filter(chip => chip.startsWith('node '))
      .map(chip => chip.replace(/^node\s+/, '')) ?? [])
  ]).slice(0, 4);
  const predictedScopeChips = activeReplayScopeSeed?.scopeChips ?? [];
  const replayScopeLabel = activeReplayScopeSeed?.sourceLabel;

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">Run Workbench</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            把当前输入、流程、阶段、节点过滤和 baseline compare 收到同一个执行台抬头里。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{props.bundle.task.status}</Badge>
          {inputGoal.trim() ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                props.onRerunFromSnapshot?.({
                  goal: inputGoal,
                  workflowCommand,
                  baselineTaskId: props.bundle.task.id,
                  replayScoped: false
                })
              }
            >
              Rerun From Snapshot
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" onClick={props.onRetryTask}>
            Retry Run
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Input Snapshot</p>
            <p className="mt-2 text-sm text-foreground">{inputGoal}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {workflowCommand ? <Badge variant="secondary">{workflowCommand}</Badge> : null}
              <Badge variant="outline">{props.bundle.task.id}</Badge>
              {workflow ? <Badge variant="outline">{workflow.displayName ?? workflow.id}</Badge> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Execution Head</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {workflow ? (
                <>
                  <Badge variant="secondary">{workflow.displayName ?? workflow.id}</Badge>
                  <Badge variant="outline">{workflow.id}</Badge>
                  <Badge variant="outline">v{workflow.version ?? '1.0.0'}</Badge>
                </>
              ) : null}
              {currentStage ? <Badge variant="warning">{currentStage}</Badge> : null}
              {currentNode ? <Badge variant="outline">{currentNode}</Badge> : null}
              {props.bundle.task.currentMinistry ? (
                <Badge variant="outline">{props.bundle.task.currentMinistry}</Badge>
              ) : null}
            </div>
          </div>
        </div>
        {props.replayLaunchReceipt ? (
          <div className="rounded-2xl border border-emerald-300/70 bg-emerald-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Replay Receipt</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">
                {props.replayLaunchReceipt.scoped ? 'scoped replay launched' : 'full-run replay launched'}
              </Badge>
              {props.replayLaunchReceipt.sourceLabel ? (
                <Badge variant="outline">{props.replayLaunchReceipt.sourceLabel}</Badge>
              ) : null}
              {props.replayLaunchReceipt.baselineTaskId ? (
                <Badge variant="outline">baseline {props.replayLaunchReceipt.baselineTaskId}</Badge>
              ) : (
                <Badge variant="outline">baseline none</Badge>
              )}
            </div>
            <p className="mt-2 text-sm text-emerald-900">
              新 run 已创建，并自动带入当前 replay 意图。
              {props.replayLaunchReceipt.baselineTaskId ? ' baseline compare 已同步挂载。' : ''}
            </p>
          </div>
        ) : null}
        <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Replay Draft</p>
          {replayScopeLabel || predictedScopeChips.length ? (
            <div className="mt-2 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {replayScopeLabel ? <Badge variant="warning">from {replayScopeLabel}</Badge> : null}
                  {predictedScopeChips.map(chip => (
                    <span key={`replay-scope:${chip}`}>
                      <Badge variant="outline">{chip}</Badge>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeReplayScopeSeed ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReplayCommandDraft(activeReplayScopeSeed.workflowCommand ?? '');
                        setReplayGoalDraft(activeReplayScopeSeed.goal);
                      }}
                    >
                      保留范围
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setActiveReplayScopeSeed(undefined);
                      setReplayCommandDraft(workflowCommand ?? '');
                      setReplayGoalDraft(inputGoal);
                    }}
                  >
                    清空范围
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_auto]">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Workflow Command
              <Input
                value={replayCommandDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setReplayCommandDraft(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Input Goal
              <textarea
                value={replayGoalDraft}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReplayGoalDraft(event.target.value)}
                rows={3}
                className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  props.onRerunFromSnapshot?.({
                    goal: replayGoalDraft.trim(),
                    workflowCommand: replayCommandDraft.trim() || undefined,
                    baselineTaskId: props.bundle.task.id,
                    replaySourceLabel: activeReplayScopeSeed?.sourceLabel,
                    replayScoped: Boolean(activeReplayScopeSeed)
                  })
                }
                disabled={!replayGoalDraft.trim()}
              >
                Launch Replay Draft
              </Button>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Diff Preview Before Replay
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={commandChanged ? 'warning' : 'outline'}>
                command {commandChanged ? 'changed' : 'unchanged'}
              </Badge>
              <Badge variant={inputChanged ? 'warning' : 'outline'}>
                input {inputChanged ? 'changed' : 'unchanged'}
              </Badge>
              <Badge variant={activeReplayScopeSeed ? 'warning' : 'outline'}>
                scope {activeReplayScopeSeed ? 'attached' : 'cleared'}
              </Badge>
              <Badge variant="secondary">{replayDraftGoal || 'draft empty'}</Badge>
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Snapshot Goal</p>
                <p className="mt-1 text-sm text-foreground">{snapshotGoal || 'n/a'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Replay Goal</p>
                <p className="mt-1 text-sm text-foreground">{replayDraftGoal || 'n/a'}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {predictedStages.length ? (
                predictedStages.map(stage => (
                  <span key={`replay-stage:${stage}`}>
                    <Badge variant="outline">stage {stage}</Badge>
                  </span>
                ))
              ) : (
                <Badge variant="outline">stage unknown</Badge>
              )}
              {predictedNodes.length ? (
                predictedNodes.map(node => (
                  <span key={`replay-node:${node}`}>
                    <Badge variant="secondary">node {node}</Badge>
                  </span>
                ))
              ) : (
                <Badge variant="outline">node unknown</Badge>
              )}
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Launch Intent Summary</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{replayCommandDraft.trim() || workflowCommand || 'command n/a'}</Badge>
              <Badge variant={activeReplayScopeSeed ? 'warning' : 'outline'}>
                {activeReplayScopeSeed ? 'scoped replay' : 'full-run replay'}
              </Badge>
              {replayScopeLabel ? <Badge variant="outline">{replayScopeLabel}</Badge> : null}
              {props.compareTaskId && props.baselineRun ? (
                <Badge variant="outline">baseline {props.baselineRun.taskId}</Badge>
              ) : (
                <Badge variant="outline">baseline none</Badge>
              )}
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Predicted Stages</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {predictedStages.length ? (
                    predictedStages.map(stage => (
                      <span key={`intent-stage:${stage}`}>
                        <Badge variant="outline">{stage}</Badge>
                      </span>
                    ))
                  ) : (
                    <Badge variant="outline">unknown</Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Predicted Nodes</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {predictedNodes.length ? (
                    predictedNodes.map(node => (
                      <span key={`intent-node:${node}`}>
                        <Badge variant="secondary">{node}</Badge>
                      </span>
                    ))
                  ) : (
                    <Badge variant="outline">unknown</Badge>
                  )}
                </div>
              </div>
            </div>
            {predictedScopeChips.length ? (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">Intent Scope</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {predictedScopeChips.map(chip => (
                    <span key={`intent-scope:${chip}`}>
                      <Badge variant="outline">{chip}</Badge>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Node Scope</p>
            {props.graphFilter ? (
              <>
                <p className="mt-2 text-sm text-foreground">node {props.graphFilter.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">stages {props.graphFilter.stages.length}</Badge>
                  <Badge variant="outline">spans {props.graphFilter.spanIds.length}</Badge>
                  <Badge variant="outline">checkpoints {props.graphFilter.checkpointIds.length}</Badge>
                </div>
                <div className="mt-3">
                  <Button type="button" size="sm" variant="secondary" onClick={props.onClearGraphFilter}>
                    清除节点过滤
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                当前没有启用 graph node 过滤，下面展示的是完整 run 视角。
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Baseline</p>
            {props.compareTaskId && props.baselineRun ? (
              <>
                <p className="mt-2 text-sm text-foreground">baseline {props.baselineRun.goal}</p>
                <p className="mt-1 text-xs text-muted-foreground">{props.baselineRun.taskId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{props.baselineRun.status}</Badge>
                  {props.baselineRun.currentStage ? (
                    <Badge variant="outline">{props.baselineRun.currentStage}</Badge>
                  ) : null}
                </div>
                <div className="mt-3">
                  <Button type="button" size="sm" variant="secondary" onClick={props.onClearCompare}>
                    清除基线
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                当前没有 baseline compare，下面的 diff 区域会显示为空态。
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Debug Scope</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {props.focusTarget ? (
              <Badge variant="secondary">
                focus {props.focusTarget.kind}:{props.focusTarget.id}
              </Badge>
            ) : (
              <Badge variant="outline">focus none</Badge>
            )}
            {props.graphFilter ? (
              <Badge variant="warning">node {props.graphFilter.label}</Badge>
            ) : (
              <Badge variant="outline">node full-run</Badge>
            )}
            {props.compareTaskId && props.baselineRun ? (
              <Badge variant="secondary">baseline {props.baselineRun.taskId}</Badge>
            ) : (
              <Badge variant="outline">baseline none</Badge>
            )}
            {props.compareTaskId ? (
              <Badge variant={props.graphFilter ? 'warning' : 'secondary'}>
                diff {props.graphFilter ? `node-scoped:${props.graphFilter.label}` : 'full-run'}
              </Badge>
            ) : (
              <Badge variant="outline">diff off</Badge>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Node Slice</p>
          {currentNodeSlice.length ? (
            <div className="mt-3 grid gap-2">
              {currentNodeSlice.map(item => (
                <article key={item.id} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-foreground">{item.label}</strong>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString()}</span>
                      {item.focusTarget ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const target = item.focusTarget;
                            if (!target) {
                              return;
                            }
                            props.onFocusTargetChange(target);
                            if (props.detail) {
                              props.onGraphFilterChange?.(
                                resolveGraphFilterForWorkbenchTarget({
                                  detail: props.detail,
                                  target
                                })
                              );
                            }
                          }}
                        >
                          聚焦
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">当前节点还没有可展示的局部事件切片。</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
