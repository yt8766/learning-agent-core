import type { RunBundleRecord } from '@agent/core';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RunObservatoryFocusTarget } from '@/pages/run-observatory/run-observatory-panel-support';

import type { AgentGraphOverlayFilter } from './runtime-agent-graph-overlay-support';
import { buildNodeActivityLedger } from './runtime-node-activity-ledger-support';

function getKindVariant(kind: 'trace' | 'checkpoint' | 'evidence' | 'diagnostic' | 'interrupt') {
  if (kind === 'interrupt') {
    return 'warning';
  }
  if (kind === 'diagnostic') {
    return 'destructive';
  }
  return 'outline';
}

export function RuntimeNodeActivityLedgerCard(props: {
  detail?: RunBundleRecord | null;
  graphFilter?: AgentGraphOverlayFilter;
  onFocusTargetChange: (target: RunObservatoryFocusTarget) => void;
}) {
  if (!props.detail) {
    return null;
  }

  const rows = buildNodeActivityLedger({
    detail: props.detail,
    graphFilter: props.graphFilter
  });

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">Node Activity Ledger</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            把 trace、checkpoint、evidence、diagnostic、interrupt 拉平成同一条节点活动时间线。
          </p>
        </div>
        <Badge variant="outline">{rows.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.length ? (
          rows.map(row => (
            <article key={row.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{row.node}</p>
                    <Badge variant={getKindVariant(row.kind)}>{row.kind}</Badge>
                    <Badge variant="outline">{row.title}</Badge>
                    {row.status ? <Badge variant="secondary">{row.status}</Badge> : null}
                    {row.stage ? <Badge variant="outline">{row.stage}</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{row.summary}</p>
                </div>
                <div className="grid justify-items-end gap-2">
                  <p className="text-xs text-muted-foreground">{new Date(row.at).toLocaleString()}</p>
                  {row.focusTarget ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => props.onFocusTargetChange(row.focusTarget)}
                    >
                      聚焦
                    </Button>
                  ) : null}
                </div>
              </div>
              {row.metadata.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.metadata.map(item => (
                    <span key={`${row.id}-${item}`}>
                      <Badge variant="outline">{item}</Badge>
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">当前 run 还没有可展示的节点活动记录。</p>
        )}
      </CardContent>
    </Card>
  );
}
