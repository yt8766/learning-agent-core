import { RefreshCw } from 'lucide-react';

import { DashboardCenterShell, DashboardEmptyState, DashboardMetricGrid } from '@/components/dashboard-center-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  IntelligenceChannelSummary,
  IntelligenceKnowledgeCandidate,
  IntelligenceOverviewProjection,
  IntelligenceSignal
} from './intelligence-center-types';

export function IntelligenceCenterPage({
  overview,
  loading = false,
  error,
  onRefresh
}: {
  overview: IntelligenceOverviewProjection | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}) {
  const channels = overview?.channels ?? [];
  const recentSignals = overview?.recentSignals ?? [];
  const pendingCandidates = overview?.pendingCandidates ?? [];

  return (
    <DashboardCenterShell
      title="Intelligence"
      description="Tech & AI Intelligence 信号、频道运行与待审知识候选。"
      count={pendingCandidates.length}
      actions={
        onRefresh ? (
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        ) : null
      }
    >
      {error ? (
        <DashboardEmptyState className="border-destructive/30 bg-destructive/5 text-destructive" message={error} />
      ) : null}
      <DashboardMetricGrid
        columns="md:grid-cols-3"
        items={[
          { label: 'Channels', value: channels.length, note: formatGeneratedAt(overview?.generatedAt) },
          { label: 'Recent signals', value: recentSignals.length, note: '最近捕获与归并的情报信号' },
          { label: 'Pending candidates', value: pendingCandidates.length, note: '等待进入 Knowledge 的候选' }
        ]}
      />
      <section aria-label="Channels" className="grid gap-3">
        <SectionTitle title="Channels" count={channels.length} />
        {channels.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {channels.map(channel => (
              <div key={channel.channel}>
                <ChannelCard channel={channel} />
              </div>
            ))}
          </div>
        ) : (
          <DashboardEmptyState
            message={loading ? '正在加载 Intelligence channel。' : '当前还没有 Intelligence channel 运行摘要。'}
          />
        )}
      </section>
      <section aria-label="Recent signals" className="grid gap-3">
        <SectionTitle title="Recent signals" count={recentSignals.length} />
        {recentSignals.length ? (
          <div className="grid gap-3">
            {recentSignals.map(signal => (
              <div key={signal.id}>
                <SignalCard signal={signal} />
              </div>
            ))}
          </div>
        ) : (
          <DashboardEmptyState message={loading ? '正在加载最近信号。' : '当前还没有最近信号。'} />
        )}
      </section>
      <section aria-label="Pending candidates" className="grid gap-3">
        <SectionTitle title="Pending candidates" count={pendingCandidates.length} />
        {pendingCandidates.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {pendingCandidates.map(candidate => (
              <div key={candidate.id}>
                <CandidateCard candidate={candidate} />
              </div>
            ))}
          </div>
        ) : (
          <DashboardEmptyState message={loading ? '正在加载知识候选。' : '当前没有待审知识候选。'} />
        )}
      </section>
    </DashboardCenterShell>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <Badge variant="outline">{count}</Badge>
    </div>
  );
}

function ChannelCard({ channel }: { channel: IntelligenceChannelSummary }) {
  return (
    <Card className="border-[#ecece8] bg-[#f8f8f6] shadow-none">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm">{channel.label}</CardTitle>
          <Badge variant={channel.failedQueryCount ? 'warning' : 'success'}>
            {channel.failedQueryCount ? `${channel.failedQueryCount} failed` : 'healthy'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {channel.signalCount} signals / {channel.candidateCount} candidates
        </p>
        <div className="grid grid-cols-2 gap-2">
          <MetricChip label="signals" value={channel.signalCount} />
          <MetricChip label="candidates" value={channel.candidateCount} />
        </div>
        <p className="text-xs text-muted-foreground">last run {channel.lastRunAt ?? 'not started'}</p>
      </CardContent>
    </Card>
  );
}

function SignalCard({ signal }: { signal: IntelligenceSignal }) {
  return (
    <Card className="border-[#ecece8] bg-white shadow-none">
      <CardContent className="grid gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={signal.priority === 'P0' ? 'destructive' : signal.priority === 'P1' ? 'warning' : 'outline'}>
            {signal.priority}
          </Badge>
          <Badge variant="secondary">{signal.channel}</Badge>
          <Badge variant={signal.confidence === 'high' ? 'success' : 'outline'}>{signal.confidence}</Badge>
          <Badge variant="outline">{signal.status}</Badge>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{signal.title}</h3>
          <p className="text-sm text-muted-foreground">{signal.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{signal.sourceCount} sources</span>
          <span>last seen {signal.lastSeenAt}</span>
          {signal.knowledgeDecision ? <span>{signal.knowledgeDecision}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CandidateCard({ candidate }: { candidate: IntelligenceKnowledgeCandidate }) {
  return (
    <Card className="border-[#ecece8] bg-[#f8f8f6] shadow-none">
      <CardContent className="grid gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{candidate.candidateType}</Badge>
          <Badge variant="outline">{candidate.decision}</Badge>
          <Badge variant={candidate.reviewStatus === 'pending' ? 'warning' : 'outline'}>{candidate.reviewStatus}</Badge>
        </div>
        <p className="text-sm font-medium text-foreground">{candidate.decisionReason}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>signal {candidate.signalId}</span>
          {candidate.ttlDays ? <span>ttl {candidate.ttlDays}d</span> : null}
          <span>{candidate.createdAt}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#ecece8] bg-white px-3 py-2">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function formatGeneratedAt(generatedAt?: string) {
  return generatedAt ? `generated ${generatedAt}` : 'waiting for projection';
}
