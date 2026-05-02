import type { RunBundleRecord } from '@agent/core';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildFocusDetail, type RunObservatoryFocusTarget } from './run-observatory-panel-support';

export function RunObservatoryFocusCard(props: {
  detail: RunBundleRecord;
  focusTarget?: RunObservatoryFocusTarget;
  onFocusTargetChange: (target: RunObservatoryFocusTarget) => void;
}) {
  const focusDetail = buildFocusDetail(props.detail, props.focusTarget);
  if (!focusDetail) {
    return null;
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold text-foreground">Focused Context</CardTitle>
        <Badge variant="outline">
          {focusDetail.target.kind} {focusDetail.target.id}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium text-foreground">{focusDetail.title}</p>
          <p className="mt-2 text-sm text-muted-foreground">{focusDetail.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {focusDetail.metadata.map(item => (
            <span key={item}>
              <Badge variant="outline">{item}</Badge>
            </span>
          ))}
          <Badge variant="secondary">timeline {focusDetail.relatedCounts.timeline}</Badge>
          <Badge variant="secondary">interrupts {focusDetail.relatedCounts.interrupts}</Badge>
          <Badge variant="secondary">diagnostics {focusDetail.relatedCounts.diagnostics}</Badge>
          <Badge variant="secondary">spans {focusDetail.relatedCounts.spans}</Badge>
          <Badge variant="secondary">checkpoints {focusDetail.relatedCounts.checkpoints}</Badge>
          <Badge variant="secondary">evidence {focusDetail.relatedCounts.evidence}</Badge>
        </div>
        {focusDetail.relatedTargets.length ? (
          <div className="flex flex-wrap gap-2">
            {focusDetail.relatedTargets.map(item => (
              <Button
                key={`${item.target.kind}:${item.target.id}`}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => props.onFocusTargetChange(item.target)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
