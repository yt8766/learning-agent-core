import { useEffect, useState } from 'react';

import type { RunBundleRecord } from '@agent/core';

import { getRunObservatory, getRunObservatoryDetail, isAbortedAdminRequestError } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RunObservatoryCompareCard } from '@/features/run-observatory/run-observatory-compare-card';
import { RunObservatoryPanel } from '@/features/run-observatory/run-observatory-panel';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';
import { RuntimeAgentGraphOverlayCard } from './runtime-agent-graph-overlay-card';
import { buildAgentGraphOverlayFilter, type AgentGraphOverlayFilter } from './runtime-agent-graph-overlay-support';
import { RuntimeNodeActivityLedgerCard } from './runtime-node-activity-ledger-card';
import { RuntimeExecutionStoryCard } from './runtime-execution-story-card';
import { RuntimeRunWorkbenchCard } from './runtime-run-workbench-card';
import { RuntimeRunSessionTimelineCard } from './runtime-run-session-timeline-card';
import type { RuntimeRunWorkbenchReplayDraftSeed } from './runtime-run-workbench-support';
import { RuntimeWorkflowExecutionMapCard } from './runtime-workflow-execution-map-card';
import { RuntimeQueueSelectedRunSummary } from './runtime-queue-selected-run-summary';
import { RuntimeQueueTracePanels } from './runtime-queue-trace-panels';

export function RuntimeQueueSelectedRun(
  props: Pick<
    RuntimeOverviewPanelProps,
    | 'bundle'
    | 'statusFilter'
    | 'modelFilter'
    | 'pricingSourceFilter'
    | 'executionModeFilter'
    | 'interactionKindFilter'
    | 'observatoryFocusTarget'
    | 'onObservatoryFocusTargetChange'
    | 'compareTaskId'
    | 'onCompareTaskIdChange'
    | 'graphNodeId'
    | 'onGraphNodeIdChange'
    | 'replayLaunchReceipt'
    | 'onRetryTask'
    | 'onLaunchWorkflowTask'
  >
) {
  const {
    bundle,
    statusFilter,
    modelFilter,
    pricingSourceFilter,
    executionModeFilter,
    interactionKindFilter,
    observatoryFocusTarget,
    onObservatoryFocusTargetChange,
    compareTaskId,
    onCompareTaskIdChange,
    graphNodeId,
    onGraphNodeIdChange,
    replayLaunchReceipt,
    onRetryTask,
    onLaunchWorkflowTask
  } = props;
  const [detail, setDetail] = useState<RunBundleRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compareCandidates, setCompareCandidates] = useState<RunBundleRecord['run'][]>([]);
  const [baselineDetail, setBaselineDetail] = useState<RunBundleRecord | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [graphFilter, setGraphFilter] = useState<AgentGraphOverlayFilter | undefined>(undefined);
  const [replayDraftSeed, setReplayDraftSeed] = useState<RuntimeRunWorkbenchReplayDraftSeed | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const taskId = bundle?.task.id;

    if (!taskId) {
      setDetail(null);
      setLoading(false);
      setError('');
      setReplayDraftSeed(undefined);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError('');
    void getRunObservatoryDetail(taskId)
      .then(next => {
        if (!cancelled) {
          setDetail(next);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setDetail(null);
          setError(cause instanceof Error ? cause.message : '加载 run observability 详情失败。');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bundle?.task.id]);

  useEffect(() => {
    if (!detail || !graphNodeId) {
      setGraphFilter(undefined);
      return;
    }

    setGraphFilter(buildAgentGraphOverlayFilter({ detail, nodeId: graphNodeId }));
  }, [detail, graphNodeId]);

  useEffect(() => {
    let cancelled = false;
    const taskId = bundle?.task.id;

    if (!taskId) {
      setCompareCandidates([]);
      return () => {
        cancelled = true;
      };
    }

    void getRunObservatory({
      status: statusFilter || undefined,
      model: modelFilter || undefined,
      pricingSource: pricingSourceFilter || undefined,
      executionMode: executionModeFilter === 'all' ? undefined : executionModeFilter,
      interactionKind: interactionKindFilter === 'all' ? undefined : interactionKindFilter,
      limit: 100
    })
      .then(items => {
        if (cancelled) {
          return;
        }
        const nextCandidates = items.filter(item => item.taskId !== taskId);
        setCompareCandidates(nextCandidates);
      })
      .catch(cause => {
        if (!cancelled && !isAbortedAdminRequestError(cause)) {
          setCompareCandidates([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bundle?.task.id, statusFilter, modelFilter, pricingSourceFilter, executionModeFilter, interactionKindFilter]);

  useEffect(() => {
    const taskId = bundle?.task.id;
    if (!taskId) {
      onCompareTaskIdChange(undefined);
      return;
    }

    if (compareTaskId && compareCandidates.some(item => item.taskId === compareTaskId)) {
      return;
    }

    onCompareTaskIdChange(compareCandidates[0]?.taskId);
  }, [bundle?.task.id, compareCandidates, compareTaskId, onCompareTaskIdChange]);

  const baselineRun = compareCandidates.find(item => item.taskId === compareTaskId);

  useEffect(() => {
    let cancelled = false;

    if (!compareTaskId) {
      setBaselineDetail(null);
      setBaselineLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setBaselineLoading(true);
    void getRunObservatoryDetail(compareTaskId)
      .then(next => {
        if (!cancelled) {
          setBaselineDetail(next);
        }
      })
      .catch(cause => {
        if (!cancelled && !isAbortedAdminRequestError(cause)) {
          setBaselineDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBaselineLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [compareTaskId]);

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Selected Run</CardTitle>
        <Badge variant="outline">{bundle?.task.status ?? 'idle'}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {bundle ? (
          <>
            <RuntimeRunWorkbenchCard
              bundle={bundle}
              detail={detail}
              focusTarget={observatoryFocusTarget}
              graphFilter={graphFilter}
              compareTaskId={compareTaskId}
              baselineRun={baselineRun}
              replayDraftSeed={replayDraftSeed}
              replayLaunchReceipt={replayLaunchReceipt}
              onRetryTask={() => void onRetryTask(bundle.task.id)}
              onRerunFromSnapshot={params => void onLaunchWorkflowTask(params)}
              onFocusTargetChange={onObservatoryFocusTargetChange}
              onGraphFilterChange={filter => {
                setGraphFilter(filter);
                onGraphNodeIdChange(filter?.nodeId);
              }}
              onClearGraphFilter={() => {
                setGraphFilter(undefined);
                onGraphNodeIdChange(undefined);
              }}
              onClearCompare={() => onCompareTaskIdChange(undefined)}
            />
            <RuntimeRunSessionTimelineCard
              currentRun={detail?.run}
              baselineRun={baselineRun}
              replayLaunchReceipt={replayLaunchReceipt}
            />
            <RuntimeExecutionStoryCard
              detail={detail}
              graphFilter={graphFilter}
              onFocusTargetChange={onObservatoryFocusTargetChange}
              onRequestReplayDraft={seed => setReplayDraftSeed(seed)}
            />
            <RuntimeQueueSelectedRunSummary bundle={bundle} />
            <RuntimeWorkflowExecutionMapCard
              workflow={bundle.task.resolvedWorkflow}
              detail={detail}
              title="Workflow Execution Map"
              emptyMessage="当前 run 还没有解析出 workflow。"
              onRequestReplayDraft={seed => setReplayDraftSeed(seed)}
            />
            <RuntimeNodeActivityLedgerCard
              detail={detail}
              graphFilter={graphFilter}
              onFocusTargetChange={onObservatoryFocusTargetChange}
            />
            <RuntimeAgentGraphOverlayCard
              detail={detail}
              onFocusTargetChange={onObservatoryFocusTargetChange}
              onRequestReplayDraft={seed => setReplayDraftSeed(seed)}
              onFilterChange={filter => {
                setGraphFilter(filter);
                onGraphNodeIdChange(filter?.nodeId);
              }}
              activeFilterNodeId={graphFilter?.nodeId}
            />
            <RuntimeQueueTracePanels bundle={bundle} />
            {detail ? (
              <RunObservatoryCompareCard
                currentDetail={detail}
                baselineRun={baselineRun}
                baselineDetail={baselineDetail ?? undefined}
                baselineCandidates={compareCandidates}
                compareTaskId={compareTaskId}
                onCompareTaskIdChange={onCompareTaskIdChange}
                baselineLoading={baselineLoading}
                graphFilter={graphFilter}
              />
            ) : null}
            <RunObservatoryPanel
              selectedTaskId={bundle.task.id}
              detail={detail}
              loading={loading}
              error={error}
              focusTarget={observatoryFocusTarget}
              graphFilter={graphFilter}
              onGraphFilterChange={filter => {
                setGraphFilter(filter);
                onGraphNodeIdChange(filter?.nodeId);
              }}
              onFocusTargetChange={onObservatoryFocusTargetChange}
            />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-4">
            <p className="text-sm font-medium text-foreground">当前没有选中的运行任务。</p>
            <p className="mt-2 text-sm text-muted-foreground">
              可以先在上方 `Workflow Catalog` 里选择 preset、输入 goal 并发起一次运行；创建后这里会自动展示对应 run 的
              workbench、storyline、execution map 和 observability 细节。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
