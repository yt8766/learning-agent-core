import type { RunBundleRecord } from '@agent/core';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuntimeReplayLaunchReceipt } from './runtime-run-workbench-support';

function buildSessionTimelineItems(params: {
  currentRun?: RunBundleRecord['run'];
  baselineRun?: RunBundleRecord['run'];
  replayLaunchReceipt?: RuntimeReplayLaunchReceipt;
}) {
  const items: Array<{
    id: string;
    title: string;
    summary: string;
    badges: string[];
    variant: 'outline' | 'secondary' | 'warning';
  }> = [];

  if (params.baselineRun) {
    items.push({
      id: `baseline:${params.baselineRun.taskId}`,
      title: params.baselineRun.goal,
      summary: '作为当前调试链的 baseline compare 入口。',
      badges: [params.baselineRun.taskId, params.baselineRun.status, params.baselineRun.currentStage ?? 'stage n/a'],
      variant: 'outline'
    });
  }

  const replaySourceLabel = params.currentRun?.lineage?.replaySourceLabel ?? params.replayLaunchReceipt?.sourceLabel;
  const replayScoped = params.currentRun?.lineage?.replayScoped ?? params.replayLaunchReceipt?.scoped;
  const replayBaselineTaskId =
    params.currentRun?.lineage?.baselineTaskId ??
    params.currentRun?.lineage?.parentTaskId ??
    params.replayLaunchReceipt?.baselineTaskId;

  if (params.currentRun?.lineage?.launchReason === 'replay' || params.replayLaunchReceipt) {
    items.push({
      id: `replay-receipt:${replaySourceLabel ?? 'receipt'}`,
      title: replayScoped ? 'Scoped Replay Launch' : 'Full-run Replay Launch',
      summary: replaySourceLabel ? `当前 run 由 ${replaySourceLabel} 发起。` : '当前 run 由 replay launch 发起。',
      badges: [
        replayScoped ? 'scoped' : 'full-run',
        replaySourceLabel ?? 'source n/a',
        replayBaselineTaskId ? `baseline ${replayBaselineTaskId}` : 'baseline none'
      ],
      variant: 'warning'
    });
  }

  if (params.currentRun) {
    items.push({
      id: `current:${params.currentRun.taskId}`,
      title: params.currentRun.goal,
      summary: '当前正在查看的 run。可以继续对比、聚焦、重放和追踪节点范围。',
      badges: [
        params.currentRun.taskId,
        params.currentRun.status,
        params.currentRun.currentStage ?? 'stage n/a',
        params.currentRun.currentNode ?? params.currentRun.currentMinistry ?? 'node n/a'
      ],
      variant: 'secondary'
    });
  }

  return items;
}

export function RuntimeRunSessionTimelineCard(props: {
  currentRun?: RunBundleRecord['run'];
  baselineRun?: RunBundleRecord['run'];
  replayLaunchReceipt?: RuntimeReplayLaunchReceipt;
}) {
  const items = buildSessionTimelineItems(props);

  if (!items.length || items.length === 1) {
    return null;
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">Run Session Timeline</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            把 baseline、replay 发起回执和当前 run 串成同一条调试会话链，帮助判断这次演化是怎么来的。
          </p>
        </div>
        <Badge variant="outline">{items.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item, index) => (
          <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
            <div className="flex flex-wrap items-start gap-3">
              <Badge variant="outline">#{index + 1}</Badge>
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <Badge variant={item.variant}>
                    {item.variant === 'warning' ? 'replay' : item.variant === 'secondary' ? 'current' : 'baseline'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {item.badges.map(badge => (
                    <span key={`${item.id}:${badge}`}>
                      <Badge variant="outline">{badge}</Badge>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
