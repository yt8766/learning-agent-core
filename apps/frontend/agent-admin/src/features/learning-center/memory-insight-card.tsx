import { useState } from 'react';

import { getMemoryEvidenceLinks, type getMemoryHistory } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type MemoryHistoryRecord = Awaited<ReturnType<typeof getMemoryHistory>>;

export function MemoryInsightCard(props: {
  title?: string;
  data?: MemoryHistoryRecord;
  emptyMessage?: string;
  eventLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [links, setLinks] = useState<Awaited<ReturnType<typeof getMemoryEvidenceLinks>>>([]);

  if (!props.data?.memory) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">
        {props.emptyMessage ?? '暂无可用快照'}
      </div>
    );
  }

  async function handleToggleEvidence() {
    if (!props.data?.memory?.id) {
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (links.length === 0) {
      setLoading(true);
      try {
        setLinks(await getMemoryEvidenceLinks(props.data.memory.id));
      } finally {
        setLoading(false);
      }
    }
    setExpanded(true);
  }

  function handleOpenEvidenceCenter() {
    const evidenceIds = props.data?.memory?.sourceEvidenceIds ?? [];
    if (!evidenceIds.length) {
      return;
    }
    window.sessionStorage.setItem('agent-admin:evidence-highlight-ids', JSON.stringify(evidenceIds));
    window.history.pushState(null, '', '/evidence');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  return (
    <div className="rounded-xl border border-border/60 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {props.title ? <Badge variant="secondary">{props.title}</Badge> : null}
        <Badge variant="outline">{props.data.memory.memoryType ?? 'unknown'}</Badge>
        <Badge variant="outline">{props.data.memory.scopeType ?? 'unknown'}</Badge>
        <Badge variant="outline">{props.data.memory.status ?? 'unknown'}</Badge>
        {props.data.memory.verificationStatus ? (
          <Badge
            variant={
              props.data.memory.verificationStatus === 'verified'
                ? 'success'
                : props.data.memory.verificationStatus === 'disputed'
                  ? 'destructive'
                  : 'outline'
            }
          >
            {props.data.memory.verificationStatus}
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{props.data.memory.summary}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="outline">evidence {(props.data.memory.sourceEvidenceIds ?? []).length}</Badge>
        {props.data.memory.lastVerifiedAt ? (
          <Badge variant="outline">verified {props.data.memory.lastVerifiedAt}</Badge>
        ) : null}
        {(props.data.memory.sourceEvidenceIds ?? []).length > 0 ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => void handleToggleEvidence()} disabled={loading}>
              {expanded ? '收起证据' : '查看证据'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleOpenEvidenceCenter}>
              去证据中心
            </Button>
          </>
        ) : null}
      </div>
      <MemoryUsageMetrics metrics={props.data.memory.usageMetrics} className="mt-2" />
      {expanded ? (
        <div className="mt-2 grid gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-3">
          {links.length > 0 ? (
            links.map(link => (
              <div key={link.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{link.evidenceId}</Badge>
                {link.sourceType ? <Badge variant="outline">{link.sourceType}</Badge> : null}
                {typeof link.confidence === 'number' ? (
                  <Badge variant="outline">confidence {link.confidence.toFixed(2)}</Badge>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">当前没有可展示的 evidence link。</p>
          )}
        </div>
      ) : null}
      <div className="mt-2 grid gap-1">
        {props.data.events
          .slice(-(props.eventLimit ?? 3))
          .reverse()
          .map(event => (
            <p key={event.id} className="text-xs text-muted-foreground">
              {event.eventType} · v{event.version} · {event.createdAt}
            </p>
          ))}
      </div>
    </div>
  );
}

export function MemoryUsageMetrics(props: {
  metrics?:
    | {
        retrievedCount: number;
        injectedCount: number;
        adoptedCount: number;
        dismissedCount: number;
        correctedCount?: number;
      }
    | undefined;
  className?: string;
}) {
  const metrics = props.metrics;
  return (
    <div className={props.className ? `flex flex-wrap gap-2 ${props.className}` : 'flex flex-wrap gap-2'}>
      <MetricBadge label="retrieved" value={metrics?.retrievedCount ?? 0} />
      <MetricBadge label="injected" value={metrics?.injectedCount ?? 0} />
      <MetricBadge label="adopted" value={metrics?.adoptedCount ?? 0} />
      <MetricBadge label="dismissed" value={metrics?.dismissedCount ?? 0} />
      <MetricBadge label="corrected" value={metrics?.correctedCount ?? 0} />
    </div>
  );
}

function MetricBadge(props: { label: string; value: number }) {
  return (
    <Badge variant="outline">
      {props.label} {props.value}
    </Badge>
  );
}
