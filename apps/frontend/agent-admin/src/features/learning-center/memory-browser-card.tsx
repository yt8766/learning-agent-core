import type { ChangeEvent } from 'react';
import { useMemo, useState } from 'react';

import { compareMemoryVersions, getMemoryHistory, searchMemories } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MemoryInsightCard } from './memory-insight-card';

type MemorySearchResponse = Awaited<ReturnType<typeof searchMemories>>;
type MemoryHistoryRecord = Awaited<ReturnType<typeof getMemoryHistory>>;
type SearchMemoryRecord = MemorySearchResponse['coreMemories'][number];

const STATUS_FILTERS = ['all', 'active', 'stale', 'disputed', 'archived'] as const;
const MEMORY_TYPE_FILTERS = ['all', 'constraint', 'preference', 'procedure', 'failure-pattern'] as const;

export function MemoryBrowserCard(props: {
  onInvalidateMemory?: (memoryId: string) => Promise<void> | void;
  onRestoreMemory?: (memoryId: string) => Promise<void> | void;
  onRetireMemory?: (memoryId: string) => Promise<void> | void;
}) {
  const [query, setQuery] = useState('memory');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [memoryTypeFilter, setMemoryTypeFilter] = useState<(typeof MEMORY_TYPE_FILTERS)[number]>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MemorySearchResponse>();
  const [selectedHistory, setSelectedHistory] = useState<MemoryHistoryRecord>();
  const [selectedMemoryId, setSelectedMemoryId] = useState('');
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [compareVersions, setCompareVersions] = useState<{ left: string; right: string }>({ left: '', right: '' });
  const [compareResult, setCompareResult] = useState<Awaited<ReturnType<typeof compareMemoryVersions>>>();
  const [compareLoading, setCompareLoading] = useState(false);

  const memories = useMemo(() => {
    const items = [...(result?.coreMemories ?? []), ...(result?.archivalMemories ?? [])];
    if (statusFilter === 'all') {
      return items;
    }
    return items.filter(item => item.status === statusFilter);
  }, [result, statusFilter]);

  const reasonsById = useMemo(() => new Map((result?.reasons ?? []).map(item => [item.id, item] as const)), [result]);
  const usageSummary = useMemo(() => {
    const items = [...(result?.coreMemories ?? []), ...(result?.archivalMemories ?? [])];
    return items.reduce(
      (summary, item) => {
        summary.retrieved += item.usageMetrics?.retrievedCount ?? 0;
        summary.injected += item.usageMetrics?.injectedCount ?? 0;
        summary.adopted += item.usageMetrics?.adoptedCount ?? 0;
        summary.dismissed += item.usageMetrics?.dismissedCount ?? 0;
        summary.corrected += item.usageMetrics?.correctedCount ?? 0;
        return summary;
      },
      { retrieved: 0, injected: 0, adopted: 0, dismissed: 0, corrected: 0 }
    );
  }, [result]);
  const adoptionRate = usageSummary.injected > 0 ? Math.round((usageSummary.adopted / usageSummary.injected) * 100) : 0;

  async function handleSearch() {
    if (!query.trim()) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await searchMemories({
        query: query.trim(),
        limit: 12,
        scopeContext: {
          actorRole: 'agent-admin-user',
          allowedScopeTypes: ['session', 'user', 'task', 'workspace', 'team', 'org', 'global']
        },
        memoryTypes: memoryTypeFilter === 'all' ? undefined : [memoryTypeFilter],
        includeRules: true,
        includeReflections: true
      });
      setResult(next);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '搜索 memory 失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectMemory(memoryId: string) {
    setSelectedMemoryId(memoryId);
    setSelectedLoading(true);
    setError('');
    try {
      const history = await getMemoryHistory(memoryId);
      const latestVersion = history.memory?.version ? String(history.memory.version) : '';
      const previousVersion =
        history.events.length > 1 ? String(history.events[history.events.length - 2]?.version ?? '') : latestVersion;
      setSelectedHistory(history);
      setCompareVersions({ left: previousVersion, right: latestVersion });
      setCompareResult(undefined);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '加载 memory 快照失败');
    } finally {
      setSelectedLoading(false);
    }
  }

  async function handleCompareVersions() {
    if (!selectedMemoryId || !compareVersions.left || !compareVersions.right) {
      return;
    }
    setCompareLoading(true);
    setError('');
    try {
      setCompareResult(
        await compareMemoryVersions(selectedMemoryId, Number(compareVersions.left), Number(compareVersions.right))
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '加载 version compare 失败');
    } finally {
      setCompareLoading(false);
    }
  }

  async function handleRefreshSelectedMemory(memoryId: string) {
    await handleSearch();
    if (selectedMemoryId === memoryId) {
      await handleSelectMemory(memoryId);
    }
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Memory Browser</CardTitle>
        <Badge variant="outline">active / stale / disputed / archived</Badge>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section className="grid gap-3">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索长期记忆，如 deploy / approval / rust"
            />
            <Button size="sm" variant="outline" onClick={() => void handleSearch()} disabled={loading}>
              {loading ? '搜索中…' : '搜索记忆'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(filter => (
              <Button
                key={filter}
                size="sm"
                variant={statusFilter === filter ? 'default' : 'ghost'}
                onClick={() => setStatusFilter(filter)}
              >
                {filter}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {MEMORY_TYPE_FILTERS.map(filter => (
              <Button
                key={filter}
                size="sm"
                variant={memoryTypeFilter === filter ? 'default' : 'ghost'}
                onClick={() => setMemoryTypeFilter(filter)}
              >
                {filter}
              </Button>
            ))}
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {result ? (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">memory {result.coreMemories.length + result.archivalMemories.length}</Badge>
              <Badge variant="outline">rules {result.rules.length}</Badge>
              <Badge variant="outline">reflections {result.reflections.length}</Badge>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3">
          {memories.length ? (
            <div className="grid gap-3">
              {memories.map(memory => (
                <div key={memory.id}>
                  <MemorySearchResultRow
                    memory={memory}
                    selected={selectedMemoryId === memory.id}
                    reason={reasonsById.get(memory.id)}
                    onSelect={handleSelectMemory}
                    onInvalidateMemory={props.onInvalidateMemory}
                    onRestoreMemory={props.onRestoreMemory}
                    onRetireMemory={props.onRetireMemory}
                    onRefresh={handleRefreshSelectedMemory}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
              {result ? '当前筛选下没有命中的 memory。' : '先执行一次搜索，再从结果里挑选需要治理的长期记忆。'}
            </div>
          )}
        </section>

        {result ? (
          <section className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-4">
            <p className="text-sm font-medium text-foreground">Memory Feedback Insight</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">retrieved {usageSummary.retrieved}</Badge>
              <Badge variant="outline">injected {usageSummary.injected}</Badge>
              <Badge variant="outline">adopted {usageSummary.adopted}</Badge>
              <Badge variant="outline">dismissed {usageSummary.dismissed}</Badge>
              <Badge variant="outline">corrected {usageSummary.corrected}</Badge>
              <Badge variant="outline">adoption rate {adoptionRate}%</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              当前反馈洞察基于这次搜索命中的 memory 集合聚合，适合快速判断哪些长期记忆被采用、被忽略或被纠正。
            </p>
          </section>
        ) : null}

        <section className="grid gap-3">
          <p className="text-sm font-medium text-foreground">Selected Memory Snapshot</p>
          {selectedLoading ? (
            <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
              正在加载 memory history…
            </div>
          ) : (
            <MemoryInsightCard
              data={selectedHistory}
              emptyMessage="选择一条 memory 后可查看快照、事件链与 evidence link。"
              eventLimit={5}
            />
          )}
          {selectedHistory?.events?.length ? (
            <div className="grid gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-4">
              <p className="text-sm font-medium text-foreground">Version Compare</p>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label className="grid gap-1 text-xs text-muted-foreground">
                  left version
                  <select
                    className="rounded-md border border-border/60 bg-background px-2 py-2 text-sm text-foreground"
                    value={compareVersions.left}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setCompareVersions(current => ({ ...current, left: event.target.value }))
                    }
                  >
                    {selectedHistory.events.map(event => (
                      <option key={`left-${event.id}`} value={event.version}>
                        v{event.version}
                      </option>
                    ))}
                    {selectedHistory.memory?.version ? (
                      <option value={selectedHistory.memory.version}>v{selectedHistory.memory.version}</option>
                    ) : null}
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  right version
                  <select
                    className="rounded-md border border-border/60 bg-background px-2 py-2 text-sm text-foreground"
                    value={compareVersions.right}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setCompareVersions(current => ({ ...current, right: event.target.value }))
                    }
                  >
                    {selectedHistory.events.map(event => (
                      <option key={`right-${event.id}`} value={event.version}>
                        v{event.version}
                      </option>
                    ))}
                    {selectedHistory.memory?.version ? (
                      <option value={selectedHistory.memory.version}>v{selectedHistory.memory.version}</option>
                    ) : null}
                  </select>
                </label>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCompareVersions()}
                    disabled={compareLoading}
                  >
                    {compareLoading ? '对比中…' : '对比版本'}
                  </Button>
                </div>
              </div>
              {compareResult ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <VersionSnapshotCard title={`v${compareResult.leftVersion}`} snapshot={compareResult.left} />
                  <VersionSnapshotCard title={`v${compareResult.rightVersion}`} snapshot={compareResult.right} />
                  <p className="text-xs text-muted-foreground md:col-span-2">
                    current v{compareResult.currentVersion} · latest event {compareResult.latestEventType ?? 'n/a'}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}

function MemorySearchResultRow(props: {
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

function VersionSnapshotCard(props: {
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
