import { useEffect, useMemo, useState } from 'react';

import { getMemoryUsageInsights } from '@/api/admin-api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function MemoryUsageInsightCard() {
  const [insight, setInsight] = useState<Awaited<ReturnType<typeof getMemoryUsageInsights>>>();
  const [error, setError] = useState('');

  useEffect(() => {
    void getMemoryUsageInsights()
      .then(setInsight)
      .catch(nextError => setError(nextError instanceof Error ? nextError.message : '加载 memory usage insight 失败'));
  }, []);

  const topLists = useMemo(
    () => [
      { title: 'Top Adopted', items: insight?.topAdoptedMemories ?? [] },
      { title: 'Top Dismissed', items: insight?.topDismissedMemories ?? [] },
      { title: 'Top Corrected', items: insight?.topCorrectedMemories ?? [] }
    ],
    [insight]
  );

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">Usage Insight</CardTitle>
        <Badge variant="outline">global metrics</Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">memories {insight?.totalMemories ?? 0}</Badge>
          <Badge variant="outline">retrieved {insight?.totalRetrieved ?? 0}</Badge>
          <Badge variant="outline">injected {insight?.totalInjected ?? 0}</Badge>
          <Badge variant="outline">adopted {insight?.totalAdopted ?? 0}</Badge>
          <Badge variant="outline">dismissed {insight?.totalDismissed ?? 0}</Badge>
          <Badge variant="outline">corrected {insight?.totalCorrected ?? 0}</Badge>
          <Badge variant="outline">adoption rate {Math.round((insight?.adoptionRate ?? 0) * 100)}%</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-border/60 bg-background/70 px-3 py-3">
            <p className="text-sm font-medium text-foreground">Adoption By Memory Type</p>
            <div className="mt-2 grid gap-2">
              {(insight?.adoptionByMemoryType ?? []).length ? (
                insight?.adoptionByMemoryType.map(item => (
                  <div
                    key={item.memoryType}
                    className="flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span>{item.memoryType}</span>
                    <Badge variant="outline">{item.adoptedCount}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">暂无聚合 adoption 数据。</p>
              )}
            </div>
          </article>
          <article className="rounded-xl border border-border/60 bg-background/70 px-3 py-3">
            <p className="text-sm font-medium text-foreground">Count By Status</p>
            <div className="mt-2 grid gap-2">
              {(insight?.countByStatus ?? []).length ? (
                insight?.countByStatus.map(item => (
                  <div key={item.status} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.status}</span>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">暂无 status 分布数据。</p>
              )}
            </div>
          </article>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {topLists.map(list => (
            <article key={list.title} className="rounded-xl border border-border/60 bg-background/70 px-3 py-3">
              <p className="text-sm font-medium text-foreground">{list.title}</p>
              <div className="mt-2 grid gap-2">
                {list.items.length ? (
                  list.items.map(item => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border/50 px-2 py-2 text-xs text-muted-foreground"
                    >
                      <p className="font-medium text-foreground">{item.summary}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {item.memoryType ? <Badge variant="outline">{item.memoryType}</Badge> : null}
                        {item.status ? <Badge variant="outline">{item.status}</Badge> : null}
                        <Badge variant="outline">{item.value}</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">暂无命中。</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
