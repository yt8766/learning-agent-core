import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { PlatformConsoleRecord } from '@/types/admin';

export function SkillSourcesReceiptCard(props: {
  item: PlatformConsoleRecord['skillSources']['receipts'][number];
  onApproveInstall: (receiptId: string) => void;
  onRejectInstall: (receiptId: string) => void;
}) {
  const { item } = props;
  return (
    <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{item.skillId}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.result ?? 'pending result'}</p>
        </div>
        <Badge variant={item.status === 'installed' ? 'success' : 'secondary'}>{item.status}</Badge>
      </div>
      {item.phase ? <p className="mt-2 text-xs text-muted-foreground">phase: {item.phase}</p> : null}
      {item.downloadRef ? <p className="mt-1 text-xs text-muted-foreground">download: {item.downloadRef}</p> : null}
      {item.failureCode ? <p className="mt-1 text-xs text-rose-600">failure: {item.failureCode}</p> : null}
      {item.failureDetail ? <p className="mt-1 text-xs text-muted-foreground">{item.failureDetail}</p> : null}
      {item.status === 'pending' ? (
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => props.onApproveInstall(item.id)}>
            批准安装
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => props.onRejectInstall(item.id)}>
            拒绝安装
          </Button>
        </div>
      ) : null}
    </article>
  );
}
