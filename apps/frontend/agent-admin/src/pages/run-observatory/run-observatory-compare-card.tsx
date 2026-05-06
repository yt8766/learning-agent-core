import type { ChangeEvent } from 'react';

import type { RunBundleRecord } from '@agent/core';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  buildRunDetailComparison,
  filterRunBundleByGraphFilter,
  type RunObservatoryFieldDiffEntry,
  buildRunSummaryComparison,
  type RunObservatoryItemDiffEntry,
  formatDurationDelta
} from './run-observatory-compare-support';
import type { AgentGraphOverlayFilter } from '@/pages/runtime-overview/components/runtime-agent-graph-overlay-support';

function ItemDiffList(props: { title: string; variant: 'added' | 'removed'; items: RunObservatoryItemDiffEntry[] }) {
  if (!props.items.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.title}</p>
      <div className="mt-2 grid gap-2">
        {props.items.map(item => (
          <article key={item.id} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={props.variant === 'added' ? 'secondary' : 'outline'}>
                {props.variant === 'added' ? '+' : '-'}
              </Badge>
              <strong className="text-sm text-foreground">{item.label}</strong>
              <span className="text-xs text-muted-foreground">{item.id}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function FieldDiffList(props: { title: string; items: RunObservatoryFieldDiffEntry[] }) {
  if (!props.items.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.title}</p>
      <div className="mt-2 grid gap-2">
        {props.items.map(item => (
          <article key={item.id} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">~</Badge>
              <strong className="text-sm text-foreground">{item.label}</strong>
              <span className="text-xs text-muted-foreground">{item.id}</span>
            </div>
            <div className="mt-2 grid gap-1">
              {item.changes.map(change => (
                <p key={`${item.id}:${change.field}`} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{change.field}</span>: {change.baseline} →{' '}
                  {change.current}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function NodeInspectorSummary(props: {
  label: string;
  detailComparison: NonNullable<ReturnType<typeof buildRunDetailComparison>>;
}) {
  const changedFieldCount =
    props.detailComparison.fieldDiffs.traces.length +
    props.detailComparison.fieldDiffs.checkpoints.length +
    props.detailComparison.fieldDiffs.diagnostics.length +
    props.detailComparison.fieldDiffs.evidence.length +
    props.detailComparison.fieldDiffs.interrupts.length;
  const addedObjectCount =
    props.detailComparison.itemDiffs.addedTraces.length +
    props.detailComparison.itemDiffs.addedCheckpoints.length +
    props.detailComparison.itemDiffs.addedDiagnostics.length +
    props.detailComparison.itemDiffs.addedEvidence.length +
    props.detailComparison.itemDiffs.addedInterrupts.length;
  const removedObjectCount =
    props.detailComparison.itemDiffs.removedTraces.length +
    props.detailComparison.itemDiffs.removedCheckpoints.length +
    props.detailComparison.itemDiffs.removedDiagnostics.length +
    props.detailComparison.itemDiffs.removedEvidence.length +
    props.detailComparison.itemDiffs.removedInterrupts.length;

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
      <p className="text-sm font-medium text-foreground">Node Inspector</p>
      <p className="mt-1 text-xs text-muted-foreground">
        当前 compare 已收缩到节点 <span className="font-medium text-foreground">{props.label}</span> 的作用域。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">
          timeline {props.detailComparison.timelineDelta >= 0 ? '+' : ''}
          {props.detailComparison.timelineDelta}
        </Badge>
        <Badge variant="outline">
          traces {props.detailComparison.traceDelta >= 0 ? '+' : ''}
          {props.detailComparison.traceDelta}
        </Badge>
        <Badge variant="outline">
          checkpoints {props.detailComparison.checkpointDelta >= 0 ? '+' : ''}
          {props.detailComparison.checkpointDelta}
        </Badge>
        <Badge variant="outline">
          diagnostics {props.detailComparison.diagnosticDelta >= 0 ? '+' : ''}
          {props.detailComparison.diagnosticDelta}
        </Badge>
        <Badge variant="outline">
          evidence {props.detailComparison.evidenceDelta >= 0 ? '+' : ''}
          {props.detailComparison.evidenceDelta}
        </Badge>
        <Badge variant="outline">
          interrupts {props.detailComparison.interruptDelta >= 0 ? '+' : ''}
          {props.detailComparison.interruptDelta}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="secondary">added objects {addedObjectCount}</Badge>
        <Badge variant="outline">removed objects {removedObjectCount}</Badge>
        <Badge variant="warning">changed fields {changedFieldCount}</Badge>
      </div>
    </div>
  );
}

export function RunObservatoryCompareCard(props: {
  currentDetail: RunBundleRecord;
  baselineRun?: RunBundleRecord['run'];
  baselineDetail?: RunBundleRecord;
  baselineCandidates: RunBundleRecord['run'][];
  compareTaskId?: string;
  onCompareTaskIdChange: (taskId?: string) => void;
  baselineLoading?: boolean;
  graphFilter?: AgentGraphOverlayFilter;
}) {
  const scopedCurrentDetail = filterRunBundleByGraphFilter(props.currentDetail, props.graphFilter);
  const scopedBaselineDetail = props.baselineDetail
    ? filterRunBundleByGraphFilter(props.baselineDetail, props.graphFilter)
    : undefined;
  const comparison =
    props.baselineRun && props.baselineRun.taskId !== props.currentDetail.run.taskId
      ? buildRunSummaryComparison(props.currentDetail.run, props.baselineRun)
      : undefined;
  const detailComparison =
    scopedBaselineDetail && scopedBaselineDetail.run.taskId !== scopedCurrentDetail.run.taskId
      ? buildRunDetailComparison(scopedCurrentDetail, scopedBaselineDetail)
      : undefined;

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-foreground">Compare / Diff</CardTitle>
        <div className="flex flex-wrap gap-2">
          {props.graphFilter ? <Badge variant="warning">node {props.graphFilter.label}</Badge> : null}
          <Badge variant="outline">{props.baselineCandidates.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          选择对比基线
          <select
            value={props.compareTaskId ?? ''}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              props.onCompareTaskIdChange(event.target.value || undefined)
            }
            className="rounded-2xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">不对比</option>
            {props.baselineCandidates.map(run => (
              <option key={run.taskId} value={run.taskId}>
                {run.goal} / {run.taskId}
              </option>
            ))}
          </select>
        </label>
        {comparison ? (
          <>
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">{comparison.baselineGoal}</p>
              <p className="mt-1 text-xs text-muted-foreground">{comparison.baselineTaskId}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={comparison.currentStatus === comparison.baselineStatus ? 'outline' : 'secondary'}>
                status {comparison.baselineStatus} → {comparison.currentStatus}
              </Badge>
              <Badge variant={comparison.stageChanged ? 'secondary' : 'outline'}>
                stage {comparison.baselineStage ?? 'n/a'} → {comparison.currentStage ?? 'n/a'}
              </Badge>
              <Badge variant="outline">{formatDurationDelta(comparison.durationDeltaMs)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {comparison.currentModels.length ? (
                <Badge variant="secondary">current {comparison.currentModels.join(', ')}</Badge>
              ) : null}
              {comparison.baselineModels.length ? (
                <Badge variant="outline">baseline {comparison.baselineModels.join(', ')}</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {comparison.addedFlags.map(flag => (
                <span key={`added-flag:${flag}`}>
                  <Badge variant="secondary">+flag {flag}</Badge>
                </span>
              ))}
              {comparison.removedFlags.map(flag => (
                <span key={`removed-flag:${flag}`}>
                  <Badge variant="outline">-flag {flag}</Badge>
                </span>
              ))}
              {comparison.addedDiagnostics.map(flag => (
                <span key={`added-diag:${flag}`}>
                  <Badge variant="warning">+diag {flag}</Badge>
                </span>
              ))}
              {comparison.removedDiagnostics.map(flag => (
                <span key={`removed-diag:${flag}`}>
                  <Badge variant="outline">-diag {flag}</Badge>
                </span>
              ))}
            </div>
            {props.baselineLoading ? (
              <p className="text-xs text-muted-foreground">正在加载 baseline detail diff...</p>
            ) : detailComparison ? (
              <>
                {props.graphFilter ? (
                  <NodeInspectorSummary label={props.graphFilter.label} detailComparison={detailComparison} />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    timeline {detailComparison.timelineDelta >= 0 ? '+' : ''}
                    {detailComparison.timelineDelta}
                  </Badge>
                  <Badge variant="outline">
                    traces {detailComparison.traceDelta >= 0 ? '+' : ''}
                    {detailComparison.traceDelta}
                  </Badge>
                  <Badge variant="outline">
                    checkpoints {detailComparison.checkpointDelta >= 0 ? '+' : ''}
                    {detailComparison.checkpointDelta}
                  </Badge>
                  <Badge variant="outline">
                    interrupts {detailComparison.interruptDelta >= 0 ? '+' : ''}
                    {detailComparison.interruptDelta}
                  </Badge>
                  <Badge variant="outline">
                    evidence {detailComparison.evidenceDelta >= 0 ? '+' : ''}
                    {detailComparison.evidenceDelta}
                  </Badge>
                  <Badge variant="outline">
                    diagnostics {detailComparison.diagnosticDelta >= 0 ? '+' : ''}
                    {detailComparison.diagnosticDelta}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detailComparison.addedTraceNodes.map(node => (
                    <span key={`added-trace:${node}`}>
                      <Badge variant="secondary">+trace {node}</Badge>
                    </span>
                  ))}
                  {detailComparison.removedTraceNodes.map(node => (
                    <span key={`removed-trace:${node}`}>
                      <Badge variant="outline">-trace {node}</Badge>
                    </span>
                  ))}
                  {detailComparison.addedInterruptKinds.map(kind => (
                    <span key={`added-interrupt:${kind}`}>
                      <Badge variant="warning">+interrupt {kind}</Badge>
                    </span>
                  ))}
                  {detailComparison.removedInterruptKinds.map(kind => (
                    <span key={`removed-interrupt:${kind}`}>
                      <Badge variant="outline">-interrupt {kind}</Badge>
                    </span>
                  ))}
                  {detailComparison.addedEvidenceSources.map(source => (
                    <span key={`added-evidence:${source}`}>
                      <Badge variant="secondary">+evidence {source}</Badge>
                    </span>
                  ))}
                  {detailComparison.removedEvidenceSources.map(source => (
                    <span key={`removed-evidence:${source}`}>
                      <Badge variant="outline">-evidence {source}</Badge>
                    </span>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ItemDiffList title="Added Traces" variant="added" items={detailComparison.itemDiffs.addedTraces} />
                  <ItemDiffList
                    title="Removed Traces"
                    variant="removed"
                    items={detailComparison.itemDiffs.removedTraces}
                  />
                  <ItemDiffList
                    title="Added Checkpoints"
                    variant="added"
                    items={detailComparison.itemDiffs.addedCheckpoints}
                  />
                  <ItemDiffList
                    title="Removed Checkpoints"
                    variant="removed"
                    items={detailComparison.itemDiffs.removedCheckpoints}
                  />
                  <ItemDiffList
                    title="Added Diagnostics"
                    variant="added"
                    items={detailComparison.itemDiffs.addedDiagnostics}
                  />
                  <ItemDiffList
                    title="Removed Diagnostics"
                    variant="removed"
                    items={detailComparison.itemDiffs.removedDiagnostics}
                  />
                  <ItemDiffList
                    title="Added Evidence"
                    variant="added"
                    items={detailComparison.itemDiffs.addedEvidence}
                  />
                  <ItemDiffList
                    title="Removed Evidence"
                    variant="removed"
                    items={detailComparison.itemDiffs.removedEvidence}
                  />
                  <ItemDiffList
                    title="Added Interrupts"
                    variant="added"
                    items={detailComparison.itemDiffs.addedInterrupts}
                  />
                  <ItemDiffList
                    title="Removed Interrupts"
                    variant="removed"
                    items={detailComparison.itemDiffs.removedInterrupts}
                  />
                  <FieldDiffList title="Changed Traces" items={detailComparison.fieldDiffs.traces} />
                  <FieldDiffList title="Changed Checkpoints" items={detailComparison.fieldDiffs.checkpoints} />
                  <FieldDiffList title="Changed Diagnostics" items={detailComparison.fieldDiffs.diagnostics} />
                  <FieldDiffList title="Changed Evidence" items={detailComparison.fieldDiffs.evidence} />
                  <FieldDiffList title="Changed Interrupts" items={detailComparison.fieldDiffs.interrupts} />
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            从当前筛选结果里选择一个 baseline run，这里会展示状态、stage、duration、flags 和 diagnostics 的差异。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
