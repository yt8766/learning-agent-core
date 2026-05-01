import { Badge } from '@/components/ui/badge';
import type { CompanyLiveNodeTrace } from '@agent/core';

interface CompanyLiveNodeTraceProps {
  trace: CompanyLiveNodeTrace[];
}

const statusVariantMap: Record<CompanyLiveNodeTrace['status'], 'success' | 'destructive' | 'secondary'> = {
  succeeded: 'success',
  failed: 'destructive',
  skipped: 'secondary'
};

const statusLabelMap: Record<CompanyLiveNodeTrace['status'], string> = {
  succeeded: '✓ 成功',
  failed: '✗ 失败',
  skipped: '— 跳过'
};

export function CompanyLiveNodeTracePanel({ trace }: CompanyLiveNodeTraceProps) {
  if (!trace.length) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card/90 p-4">
      <p className="text-sm font-semibold text-foreground">节点执行轨迹</p>
      <ol className="mt-3 space-y-3">
        {trace.map((entry, idx) => (
          <li key={`${entry.nodeId}-${idx}`} className="relative pl-6">
            {/* 轨迹连接线 */}
            {idx < trace.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px bg-border/50" />}
            {/* 状态圆点 */}
            <span
              className={`absolute left-0 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold ${
                entry.status === 'succeeded'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : entry.status === 'failed'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {idx + 1}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-semibold text-foreground">{entry.nodeId}</span>
              <Badge variant={statusVariantMap[entry.status]}>{statusLabelMap[entry.status]}</Badge>
              <span className="text-[11px] text-muted-foreground">{entry.durationMs} ms</span>
            </div>

            {entry.errorMessage && <p className="mt-1 text-xs text-destructive">{entry.errorMessage}</p>}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/30 px-2 py-1.5">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">输入</p>
                <pre className="overflow-x-auto text-[11px] text-muted-foreground">
                  {JSON.stringify(entry.inputSnapshot, null, 2)}
                </pre>
              </div>
              <div className="rounded-lg bg-muted/30 px-2 py-1.5">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">输出</p>
                <pre className="overflow-x-auto text-[11px] text-muted-foreground">
                  {JSON.stringify(entry.outputSnapshot, null, 2)}
                </pre>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
