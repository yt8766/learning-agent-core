import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuntimeOverviewPanelProps } from './runtime-overview-types';
import { RuntimeQueueSelectedRunSummary } from './runtime-queue-selected-run-summary';
import { RuntimeQueueTracePanels } from './runtime-queue-trace-panels';

export function RuntimeQueueSelectedRun({ bundle }: Pick<RuntimeOverviewPanelProps, 'bundle'>) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Selected Run</CardTitle>
        <Badge variant="outline">{bundle?.task.status ?? 'idle'}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {bundle ? (
          <>
            <RuntimeQueueSelectedRunSummary bundle={bundle} />
            <RuntimeQueueTracePanels bundle={bundle} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">当前没有选中的运行任务。</p>
        )}
      </CardContent>
    </Card>
  );
}
