import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RuntimeOverviewPanelProps {
  status?: string;
  taskCount: number;
  pendingApprovalsCount: number;
  skillsCount: number;
  rulesCount: number;
  runtimeBadges: string[];
  latestTraces: Array<{ node: string; at: string; summary: string }>;
}

export function RuntimeOverviewPanel(props: RuntimeOverviewPanelProps) {
  const { status, taskCount, pendingApprovalsCount, skillsCount, rulesCount, runtimeBadges, latestTraces } = props;

  return (
    <>
      <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold text-stone-900">运行总览</CardTitle>
          <Badge variant="secondary">{status ?? '无活动任务'}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <strong className="block text-sm text-stone-500">任务数</strong>
              <span className="mt-2 block text-2xl font-semibold text-stone-950">{taskCount}</span>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <strong className="block text-sm text-stone-500">待审批</strong>
              <span className="mt-2 block text-2xl font-semibold text-stone-950">{pendingApprovalsCount}</span>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <strong className="block text-sm text-stone-500">实验技能</strong>
              <span className="mt-2 block text-2xl font-semibold text-stone-950">{skillsCount}</span>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <strong className="block text-sm text-stone-500">规则数</strong>
              <span className="mt-2 block text-2xl font-semibold text-stone-950">{rulesCount}</span>
            </article>
          </div>
          <div className="flex flex-wrap gap-2">
            {runtimeBadges.map(badge => (
              <span key={badge}>
                <Badge variant="outline" className="rounded-full border-stone-300 bg-stone-100 text-stone-700">
                  {badge}
                </Badge>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 border-stone-200 bg-white/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-semibold text-stone-900">图运行态</CardTitle>
          <Badge variant="outline">{latestTraces.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestTraces.length === 0 ? (
            <p className="text-sm text-stone-500">暂无运行轨迹。</p>
          ) : (
            latestTraces.map((trace, index) => (
              <article
                key={`${trace.node}-${trace.at}-${index}`}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm font-semibold text-stone-900">{trace.node}</strong>
                  <span className="text-xs text-stone-500">{trace.at}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{trace.summary}</p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
