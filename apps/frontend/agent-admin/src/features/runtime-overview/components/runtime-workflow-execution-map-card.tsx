import type { RunBundleRecord } from '@agent/core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildWorkflowExecutionMap, type WorkflowExecutionMapWorkflow } from './runtime-workflow-execution-map-support';
import {
  buildReplayDraftSeedFromStage,
  type RuntimeRunWorkbenchReplayDraftSeed
} from './runtime-run-workbench-support';

function getStatusVariant(status: 'pending' | 'running' | 'completed' | 'blocked' | 'failed') {
  if (status === 'failed') {
    return 'destructive';
  }
  if (status === 'blocked') {
    return 'warning';
  }
  if (status === 'running') {
    return 'success';
  }
  return status === 'completed' ? 'secondary' : 'outline';
}

export function RuntimeWorkflowExecutionMapCard(props: {
  workflow?: WorkflowExecutionMapWorkflow;
  detail?: RunBundleRecord | null;
  title?: string;
  emptyMessage?: string;
  onRequestReplayDraft?: (seed: RuntimeRunWorkbenchReplayDraftSeed) => void;
}) {
  if (!props.workflow && !props.detail) {
    return null;
  }

  const stages = buildWorkflowExecutionMap({
    workflow: props.workflow,
    detail: props.detail
  });
  const detail = props.detail ?? undefined;

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            {props.title ?? 'Workflow Execution Map'}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {props.workflow
              ? `${props.workflow.displayName} / ${props.workflow.id}`
              : (props.emptyMessage ?? '当前没有可展示的 workflow。')}
          </p>
        </div>
        <Badge variant="outline">{stages.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {stages.map(stage => (
          <article key={stage.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{stage.title}</p>
                  <Badge variant={getStatusVariant(stage.status)}>{stage.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{stage.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {stage.traces.length ? <Badge variant="outline">trace {stage.traces.length}</Badge> : null}
                {stage.checkpoints.length ? (
                  <Badge variant="outline">checkpoint {stage.checkpoints.length}</Badge>
                ) : null}
                {stage.evidence.length ? <Badge variant="outline">evidence {stage.evidence.length}</Badge> : null}
                {stage.diagnostics.length ? <Badge variant="outline">diag {stage.diagnostics.length}</Badge> : null}
                {stage.interrupts.length ? <Badge variant="outline">interrupt {stage.interrupts.length}</Badge> : null}
                {detail ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      props.onRequestReplayDraft?.(
                        buildReplayDraftSeedFromStage({
                          runGoal: detail.run.goal,
                          stage
                        })
                      )
                    }
                  >
                    送到 Replay Draft
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {stage.traces.map(trace => (
                <div key={trace.spanId} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-foreground">{trace.node}</strong>
                    <Badge variant="outline">{trace.status}</Badge>
                    {trace.modelUsed ? <Badge variant="outline">{trace.modelUsed}</Badge> : null}
                    {typeof trace.latencyMs === 'number' ? <Badge variant="outline">{trace.latencyMs}ms</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{trace.summary}</p>
                </div>
              ))}
              {stage.checkpoints.map(checkpoint => (
                <div
                  key={checkpoint.checkpointId}
                  className="rounded-xl border border-border/60 bg-background/80 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-foreground">{checkpoint.checkpointId}</strong>
                    <Badge variant="outline">{checkpoint.recoverability}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{checkpoint.summary}</p>
                </div>
              ))}
              {!stage.traces.length &&
              !stage.checkpoints.length &&
              !stage.evidence.length &&
              !stage.diagnostics.length &&
              !stage.interrupts.length ? (
                <p className="text-xs text-muted-foreground">当前这个阶段还没有节点级运行记录。</p>
              ) : null}
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
