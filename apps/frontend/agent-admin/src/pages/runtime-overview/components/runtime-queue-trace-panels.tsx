import { Badge } from '@/components/ui/badge';
import type { TaskBundle } from '@/types/admin';

import {
  buildTraceView,
  buildTraceWaterfallRows,
  getAuditEntrySummary,
  getAuditEntryTitle,
  getTraceNodeLabel,
  getTraceSummaryCopy,
  resolveCriticalPathSummary
} from './runtime-queue-section-support';

export function RuntimeQueueTracePanels({ bundle }: { bundle: TaskBundle }) {
  const criticalPath = resolveCriticalPathSummary(bundle);

  return (
    <>
      {criticalPath ? (
        <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
          <p className="text-sm font-semibold text-foreground">Critical Path</p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <p>Path: {criticalPath.pathLabel}</p>
            <p>Total Latency: {criticalPath.totalLatencyMs}ms</p>
            {criticalPath.slowestNode ? <p>Slowest Span: {criticalPath.slowestNode}</p> : null}
            {criticalPath.fallbackNodes.length ? <p>Fallback Nodes: {criticalPath.fallbackNodes.join(' / ')}</p> : null}
            {bundle.audit?.traceSummary?.reviseSpans.length ? (
              <p>Revise Spans: {bundle.audit.traceSummary.reviseSpans.join(' / ')}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-foreground">Trace Waterfall</p>
        {buildTraceWaterfallRows(bundle.traces).map((trace, index) => (
          <article
            key={`${trace.spanId ?? trace.node}-${index}`}
            className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <strong className="text-sm text-foreground">{getTraceNodeLabel(trace.node)}</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {trace.chainLabel}
                  {trace.parentNode ? ` / 依赖 ${trace.parentNode}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {trace.role ? <Badge variant="outline">{trace.role}</Badge> : null}
                {trace.specialistId ? <Badge variant="outline">{trace.specialistId}</Badge> : null}
                {typeof trace.latencyMs === 'number' ? <Badge variant="outline">{trace.latencyMs}ms</Badge> : null}
                {trace.modelUsed ? <Badge variant="outline">{trace.modelUsed}</Badge> : null}
                {trace.isFallback ? <Badge variant="outline">fallback</Badge> : null}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/70">
              <div
                className={`h-full rounded-full ${trace.isFallback ? 'bg-amber-500' : 'bg-foreground'}`}
                style={{ marginLeft: `${trace.offsetPercent}%`, width: `${trace.widthPercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{getTraceSummaryCopy(trace)}</p>
            {trace.fallbackReason ? (
              <p className="mt-2 text-xs leading-5 text-amber-700">fallback reason: {trace.fallbackReason}</p>
            ) : null}
          </article>
        ))}
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-semibold text-foreground">Latest Traces</p>
        {buildTraceView(bundle.traces)
          .slice(-6)
          .reverse()
          .map((trace, index) => (
            <article
              key={`${trace.node}-${trace.at}-${index}`}
              className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3"
              style={{ marginLeft: `${trace.depth * 12}px` }}
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm text-foreground">{getTraceNodeLabel(trace.node)}</strong>
                <span className="text-xs text-muted-foreground">{trace.at}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {trace.role ? <Badge variant="outline">{trace.role}</Badge> : null}
                {trace.status ? <Badge variant="outline">{trace.status}</Badge> : null}
                {trace.specialistId ? <Badge variant="outline">{trace.specialistId}</Badge> : null}
                {trace.modelUsed ? <Badge variant="outline">{trace.modelUsed}</Badge> : null}
                {typeof trace.latencyMs === 'number' ? <Badge variant="outline">{trace.latencyMs}ms</Badge> : null}
                {trace.isFallback ? <Badge variant="outline">fallback</Badge> : null}
                {trace.parentSpanId ? <Badge variant="outline">depth {trace.depth}</Badge> : null}
                {trace.parentNode ? <Badge variant="outline">from {trace.parentNode}</Badge> : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{getTraceSummaryCopy(trace)}</p>
              {trace.isFallback && trace.fallbackReason ? (
                <p className="mt-2 text-xs leading-5 text-amber-700">fallback reason: {trace.fallbackReason}</p>
              ) : null}
            </article>
          ))}
      </div>
      {bundle.audit ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-foreground">Audit Replay</p>
          {bundle.audit.entries.slice(0, 6).map(entry => (
            <article key={entry.id} className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm text-foreground">{getAuditEntryTitle(entry)}</strong>
                <span className="text-xs text-muted-foreground">{entry.at}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{getAuditEntrySummary(entry)}</p>
            </article>
          ))}
          {bundle.audit.browserReplays.length ? (
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Browser Replays</p>
              <div className="mt-2 grid gap-1">
                {bundle.audit.browserReplays.map((replay, index) => (
                  <p key={`${replay.sessionId ?? 'replay'}-${index}`}>
                    {replay.sessionId ?? 'unknown'} / {replay.url ?? 'n/a'} / steps {replay.stepCount}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
