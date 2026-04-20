import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import {
  buildReplayGoal,
  uniqueValues,
  type RuntimeRunWorkbenchReplayDraftSeed
} from './runtime-run-workbench-support';

export function RuntimeRunWorkbenchReplayDraft(props: {
  taskId: string;
  workflowCommand?: string;
  inputGoal: string;
  currentStage?: string;
  currentNode?: string;
  currentMinistry?: string;
  graphFilterStages?: string[];
  graphFilterLabel?: string;
  compareTaskId?: string;
  baselineRun?: { taskId: string; goal: string; status: string; currentStage?: string };
  replayDraftSeed?: RuntimeRunWorkbenchReplayDraftSeed;
  onRerunFromSnapshot?: (params: {
    goal: string;
    workflowCommand?: string;
    baselineTaskId?: string;
    replaySourceLabel?: string;
    replayScoped?: boolean;
  }) => void;
}) {
  const {
    taskId,
    workflowCommand,
    inputGoal,
    currentStage,
    currentNode,
    currentMinistry,
    graphFilterStages,
    graphFilterLabel
  } = props;

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
  }, [workflowCommand, inputGoal, taskId]);

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
    ...(graphFilterStages ?? [])
  ]).slice(0, 4);
  const predictedNodes = uniqueValues([
    currentNode,
    currentMinistry,
    graphFilterLabel,
    ...(activeReplayScopeSeed?.scopeChips
      .filter(chip => chip.startsWith('node '))
      .map(chip => chip.replace(/^node\s+/, '')) ?? [])
  ]).slice(0, 4);
  const predictedScopeChips = activeReplayScopeSeed?.scopeChips ?? [];
  const replayScopeLabel = activeReplayScopeSeed?.sourceLabel;

  return (
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
                baselineTaskId: taskId,
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
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Diff Preview Before Replay</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant={commandChanged ? 'warning' : 'outline'}>
            command {commandChanged ? 'changed' : 'unchanged'}
          </Badge>
          <Badge variant={inputChanged ? 'warning' : 'outline'}>input {inputChanged ? 'changed' : 'unchanged'}</Badge>
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
  );
}
