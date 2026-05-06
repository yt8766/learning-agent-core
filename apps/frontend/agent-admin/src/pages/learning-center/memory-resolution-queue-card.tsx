import { useState } from 'react';

import { getMemoryHistory } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';
import type { LearningCenterRecord } from '@/types/admin';
import { MemoryInsightCard } from './memory-insight-card';

interface MemoryResolutionQueueCardProps {
  candidates: LearningCenterRecord['memoryResolutionCandidates'];
  loading: boolean;
  onResolve: (resolutionCandidateId: string, resolution: 'accepted' | 'rejected') => void;
}

export function MemoryResolutionQueueCard(props: MemoryResolutionQueueCardProps) {
  const [expandedId, setExpandedId] = useState('');
  const [loadingDetailId, setLoadingDetailId] = useState('');
  const [details, setDetails] = useState<
    Record<
      string,
      {
        challenger?: Awaited<ReturnType<typeof getMemoryHistory>>;
        incumbent?: Awaited<ReturnType<typeof getMemoryHistory>>;
      }
    >
  >({});

  async function handleToggleDetails(item: NonNullable<LearningCenterRecord['memoryResolutionCandidates']>[number]) {
    if (expandedId === item.id) {
      setExpandedId('');
      return;
    }
    if (!details[item.id]) {
      setLoadingDetailId(item.id);
      try {
        const [challenger, incumbent] = await Promise.all([
          getMemoryHistory(item.challengerId).catch(() => undefined),
          getMemoryHistory(item.incumbentId).catch(() => undefined)
        ]);
        setDetails(current => ({
          ...current,
          [item.id]: { challenger, incumbent }
        }));
      } finally {
        setLoadingDetailId('');
      }
    }
    setExpandedId(item.id);
  }

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Memory Resolution Queue</CardTitle>
        <Badge variant="outline">{props.candidates?.length ?? 0}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!props.candidates?.length ? (
          <DashboardEmptyState message="当前没有待处理的 memory 决议候选。" />
        ) : (
          props.candidates.map((item: NonNullable<LearningCenterRecord['memoryResolutionCandidates']>[number]) => (
            <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={item.requiresHumanReview ? 'warning' : 'secondary'}>{item.conflictKind}</Badge>
                <Badge variant="outline">{item.suggestedAction}</Badge>
                <Badge variant="outline">confidence {item.confidence.toFixed(2)}</Badge>
                <Badge
                  variant={
                    item.resolution === 'accepted'
                      ? 'success'
                      : item.resolution === 'rejected'
                        ? 'destructive'
                        : 'outline'
                  }
                >
                  {item.resolution}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {item.challengerId} vs {item.incumbentId}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleToggleDetails(item)}
                  disabled={loadingDetailId === item.id}
                >
                  {expandedId === item.id ? '收起详情' : '查看详情'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => props.onResolve(item.id, 'accepted')}
                  disabled={props.loading || item.resolution === 'accepted'}
                >
                  接受决议
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => props.onResolve(item.id, 'rejected')}
                  disabled={props.loading || item.resolution === 'rejected'}
                >
                  驳回
                </Button>
              </div>
              {expandedId === item.id ? (
                <div className="mt-3 grid gap-3 rounded-2xl border border-border/60 bg-background/80 p-3">
                  <MemoryInsightCard
                    title="challenger"
                    data={details[item.id]?.challenger}
                    emptyMessage="challenger: 暂无可用快照"
                  />
                  <MemoryInsightCard
                    title="incumbent"
                    data={details[item.id]?.incumbent}
                    emptyMessage="incumbent: 暂无可用快照"
                  />
                </div>
              ) : null}
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
