import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { LearningCenterRecord } from '@/types/admin';

export function GovernanceProfileCard({
  title,
  profiles,
  emptyMessage
}: {
  title: string;
  profiles:
    | LearningCenterRecord['ministryGovernanceProfiles']
    | LearningCenterRecord['workerGovernanceProfiles']
    | LearningCenterRecord['specialistGovernanceProfiles'];
  emptyMessage: string;
}) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
        <Badge variant="outline">{profiles?.length ?? 0}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!profiles?.length ? (
          <DashboardEmptyState message={emptyMessage} />
        ) : (
          profiles.slice(0, 8).map(item => (
            <article key={item.entityId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{item.trustLevel}</Badge>
                <Badge variant="secondary">{item.trustTrend}</Badge>
                {typeof item.reportCount === 'number' ? (
                  <Badge variant="outline">{item.reportCount} reports</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">{item.displayName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.entityId}</p>
              {(item.promoteCount ?? item.holdCount ?? item.downgradeCount) !== undefined ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  promote {item.promoteCount ?? 0} / hold {item.holdCount ?? 0} / downgrade {item.downgradeCount ?? 0}
                </p>
              ) : null}
              {item.lastTaskId ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  latest {item.lastTaskId}
                  {item.lastReviewDecision ? ` / ${item.lastReviewDecision}` : ''}
                </p>
              ) : null}
              {item.lastReason ? <p className="mt-1 text-xs text-muted-foreground">{item.lastReason}</p> : null}
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
