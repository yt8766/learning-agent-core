import { CheckCircle2, Clock3, LoaderCircle, XCircle } from 'lucide-react';

import { cn } from '@/utils/utils';

import type { WorkflowRunRecord } from '../api/workflow-runs.api';

interface RunHistoryListProps {
  runs: WorkflowRunRecord[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
}

function StatusIcon({ status }: { status: WorkflowRunRecord['status'] }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />;
  }

  if (status === 'failed') {
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />;
  }

  if (status === 'running') {
    return <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" aria-hidden="true" />;
  }

  return <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRunTime(startedAt: number): string {
  return new Date(startedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function RunHistoryList({ runs, selectedRunId, onSelect }: RunHistoryListProps) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">历史运行</p>
        <span className="text-xs text-muted-foreground">{runs.length}</span>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-3 py-4">
          <p className="text-xs leading-5 text-muted-foreground">暂无历史记录。</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {runs.map(run => {
            const durationMs = run.completedAt === null ? null : Math.max(0, run.completedAt - run.startedAt);

            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelect(run.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
                  selectedRunId === run.id
                    ? 'border-emerald-500 bg-emerald-50/70'
                    : 'border-border/70 bg-muted/30 hover:bg-muted/50'
                )}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                  <StatusIcon status={run.status} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs text-foreground">{run.id.slice(0, 8)}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{run.status}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {formatRunTime(run.startedAt)}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {durationMs === null ? '运行中' : formatDuration(durationMs)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
