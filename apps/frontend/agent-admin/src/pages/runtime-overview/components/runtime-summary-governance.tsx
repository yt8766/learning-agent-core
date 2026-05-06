import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { RuntimeSummarySectionProps } from './runtime-summary-types';

export function RuntimeSummaryGovernance({ runtime }: Pick<RuntimeSummarySectionProps, 'runtime'>) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Governance Audit</CardTitle>
        <Badge variant="outline">{runtime.recentGovernanceAudit?.length ?? 0}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {(runtime.recentGovernanceAudit?.length ?? 0) === 0 ? (
          <DashboardEmptyState message="当前还没有治理动作审计记录。" />
        ) : (
          runtime.recentGovernanceAudit?.map(item => (
            <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.action}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.scope} / {item.targetId} / {item.actor}
                  </p>
                </div>
                <Badge
                  variant={
                    item.outcome === 'success' ? 'success' : item.outcome === 'pending' ? 'warning' : 'destructive'
                  }
                >
                  {item.outcome}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(item.at).toLocaleString()}</p>
              {item.reason ? <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p> : null}
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
