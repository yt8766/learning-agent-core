import type { RunBundleRecord } from '@agent/core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RunObservatoryFocusTarget } from '@/features/run-observatory/run-observatory-panel-support';

import type { AgentGraphOverlayFilter } from './runtime-agent-graph-overlay-support';
import { buildRuntimeExecutionStory } from './runtime-execution-story-support';
import type { RuntimeRunWorkbenchReplayDraftSeed } from './runtime-run-workbench-support';

function getStepVariant(kind: string) {
  if (kind === 'interrupt') {
    return 'warning';
  }
  if (kind === 'diagnostic') {
    return 'destructive';
  }
  if (kind === 'trace') {
    return 'secondary';
  }
  return 'outline';
}

export function RuntimeExecutionStoryCard(props: {
  detail?: RunBundleRecord | null;
  graphFilter?: AgentGraphOverlayFilter;
  onFocusTargetChange: (target: RunObservatoryFocusTarget) => void;
  onRequestReplayDraft?: (seed: RuntimeRunWorkbenchReplayDraftSeed) => void;
}) {
  if (!props.detail) {
    return null;
  }

  const steps = buildRuntimeExecutionStory({
    detail: props.detail,
    graphFilter: props.graphFilter
  });

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">Execution Storyline</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            以执行顺序串起 stage、node、checkpoint、evidence 和 interrupt，直接回答这次 run 到底发生了什么。
          </p>
        </div>
        <Badge variant="outline">{steps.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {steps.length ? (
          steps.map((step, index) => {
            const replayDraftSeed = step.replayDraftSeed;

            return (
              <article key={step.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <Badge variant={getStepVariant(step.kind)}>{step.kind}</Badge>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      {step.status ? <Badge variant="outline">{step.status}</Badge> : null}
                      {step.stage ? <Badge variant="outline">stage {step.stage}</Badge> : null}
                      {step.nodeLabel ? <Badge variant="secondary">node {step.nodeLabel}</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.summary}</p>
                  </div>
                  <div className="grid justify-items-end gap-2">
                    <p className="text-xs text-muted-foreground">{new Date(step.at).toLocaleString()}</p>
                    {replayDraftSeed ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => props.onRequestReplayDraft?.(replayDraftSeed)}
                      >
                        送到 Replay Draft
                      </Button>
                    ) : null}
                    {step.focusTarget ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => props.onFocusTargetChange(step.focusTarget)}
                      >
                        聚焦
                      </Button>
                    ) : null}
                  </div>
                </div>
                {step.metadata.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.metadata.map(item => (
                      <span key={`${step.id}:${item}`}>
                        <Badge variant="outline">{item}</Badge>
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">当前 run 还没有足够的事件来拼出执行故事线。</p>
        )}
      </CardContent>
    </Card>
  );
}
