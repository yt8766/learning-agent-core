import { compareMemoryVersions, searchMemories } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type MemorySearchResponse = Awaited<ReturnType<typeof searchMemories>>;
type SearchMemoryRecord = MemorySearchResponse['coreMemories'][number];

export function MemorySearchResultRow(props: {
  memory: SearchMemoryRecord;
  selected: boolean;
  reason?: MemorySearchResponse['reasons'][number];
  onSelect: (memoryId: string) => Promise<void>;
  onInvalidateMemory?: (memoryId: string) => Promise<void> | void;
  onRestoreMemory?: (memoryId: string) => Promise<void> | void;
  onRetireMemory?: (memoryId: string) => Promise<void> | void;
  onRefresh?: (memoryId: string) => Promise<void>;
}) {
  async function handleAction(action: (() => Promise<void> | void) | undefined) {
    if (!action) {
      return;
    }
    await action();
    await props.onRefresh?.(props.memory.id);
  }

  return (
    <article
      className={`rounded-xl border px-3 py-3 ${props.selected ? 'border-sky-300 bg-sky-50/60' : 'border-border/60 bg-background/70'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{props.memory.memoryType ?? 'unknown'}</Badge>
        <Badge variant="outline">{props.memory.scopeType ?? 'unknown'}</Badge>
        <Badge variant="outline">{props.memory.status ?? 'unknown'}</Badge>
        {props.memory.verificationStatus ? <Badge variant="outline">{props.memory.verificationStatus}</Badge> : null}
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{props.memory.summary}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">evidence {(props.memory.sourceEvidenceIds ?? []).length}</Badge>
        <Badge variant="outline">adopted {props.memory.usageMetrics?.adoptedCount ?? 0}</Badge>
        {props.reason ? <Badge variant="outline">score {props.reason.score.toFixed(2)}</Badge> : null}
      </div>
      {props.reason ? <p className="mt-2 text-xs text-muted-foreground">reason: {props.reason.reason}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        {props.memory.status !== 'archived' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleAction(() => props.onRetireMemory?.(props.memory.id))}
          >
            归档
          </Button>
        ) : null}
        {props.memory.status === 'archived' || props.memory.status === 'stale' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleAction(() => props.onRestoreMemory?.(props.memory.id))}
          >
            恢复
          </Button>
        ) : null}
        {props.memory.status === 'active' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleAction(() => props.onInvalidateMemory?.(props.memory.id))}
          >
            失效
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => void props.onSelect(props.memory.id)}>
          查看快照
        </Button>
      </div>
    </article>
  );
}

export function VersionSnapshotCard(props: {
  title: string;
  snapshot: Awaited<ReturnType<typeof compareMemoryVersions>>['left'];
}) {
  return (
    <article className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
      <p className="text-sm font-medium text-foreground">{props.title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {props.snapshot.memoryType ? <Badge variant="outline">{props.snapshot.memoryType}</Badge> : null}
        {props.snapshot.scopeType ? <Badge variant="outline">{props.snapshot.scopeType}</Badge> : null}
        {props.snapshot.status ? <Badge variant="outline">{props.snapshot.status}</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-foreground">{props.snapshot.summary}</p>
      <p className="mt-1 text-xs text-muted-foreground">{props.snapshot.content}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">evidence {props.snapshot.sourceEvidenceIds.length}</Badge>
        <Badge variant="outline">adopted {props.snapshot.usageMetrics?.adoptedCount ?? 0}</Badge>
        <Badge variant="outline">dismissed {props.snapshot.usageMetrics?.dismissedCount ?? 0}</Badge>
        <Badge variant="outline">corrected {props.snapshot.usageMetrics?.correctedCount ?? 0}</Badge>
      </div>
    </article>
  );
}
