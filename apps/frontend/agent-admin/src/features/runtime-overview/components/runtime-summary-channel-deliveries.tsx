import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { ChannelDeliveryRecord } from '@/api/admin-api';

export function RuntimeSummaryChannelDeliveries({ channelDeliveries }: { channelDeliveries: ChannelDeliveryRecord[] }) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Channel Deliveries</CardTitle>
        <Badge variant="outline">{channelDeliveries.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {channelDeliveries.length === 0 ? (
          <DashboardEmptyState message="当前还没有多渠道投递回执。" />
        ) : (
          channelDeliveries.slice(0, 12).map(item => (
            <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {item.channel} / {item.segment}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    chat {item.channelChatId}
                    {item.taskId ? ` / task ${item.taskId}` : ''}
                  </p>
                </div>
                <Badge
                  variant={item.status === 'sent' ? 'success' : item.status === 'queued' ? 'warning' : 'destructive'}
                >
                  {item.status}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {typeof item.attemptCount === 'number' ? (
                  <Badge variant="secondary">attempt {item.attemptCount}</Badge>
                ) : null}
                {item.sessionId ? <Badge variant="secondary">{item.sessionId}</Badge> : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                queued {new Date(item.queuedAt).toLocaleString()}
                {item.deliveredAt ? ` / delivered ${new Date(item.deliveredAt).toLocaleString()}` : ''}
              </p>
              {item.failureReason ? <p className="mt-2 text-xs text-red-600">{item.failureReason}</p> : null}
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
