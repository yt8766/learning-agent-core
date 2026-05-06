import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { RuntimeCenterRecord } from '@/types/admin';

export function RuntimeSummaryBriefingAudit({ runtime }: { runtime: RuntimeCenterRecord }) {
  const categories = runtime.dailyTechBriefing?.categories ?? [];
  const records = categories.flatMap(category =>
    (category.auditRecords ?? []).map(record => ({
      ...record,
      categoryTitle: category.title
    }))
  );

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Briefing Audit Trail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前还没有可审计的技术简报记录。</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {categories.map(category => (
                <article key={category.category} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{category.title}</p>
                  {category.scheduleState ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      当前 {category.scheduleState.currentIntervalHours}h / 下次{' '}
                      {category.scheduleState.nextRunAt
                        ? new Date(category.scheduleState.nextRunAt).toLocaleString()
                        : '未安排'}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">新增 {category.newCount ?? 0}</Badge>
                    <Badge variant="outline">更新 {category.updateCount ?? 0}</Badge>
                    <Badge variant="outline">抑制 {category.crossRunSuppressedCount ?? 0}</Badge>
                    <Badge variant="outline">合并 {category.sameRunMergedCount ?? 0}</Badge>
                    <Badge variant="outline">折叠 {category.overflowCollapsedCount ?? 0}</Badge>
                    <Badge variant="outline">节省注意力 {category.savedAttentionCount ?? 0}</Badge>
                    <Badge variant="outline">👍 {category.helpful ?? 0}</Badge>
                    <Badge variant="outline">👎 {category.notHelpful ?? 0}</Badge>
                    {category.scheduleState?.lastAdaptiveReason ? (
                      <Badge variant="outline">调频 {category.scheduleState.lastAdaptiveReason}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {category.suppressedSummary ??
                      `抑制明细：跨轮去重 ${category.crossRunSuppressedCount ?? 0} / 同轮合并 ${
                        category.sameRunMergedCount ?? 0
                      } / 超上限折叠 ${category.overflowCollapsedCount ?? 0}`}
                  </p>
                  {category.preferredSourceNames?.length ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      偏好来源：{category.preferredSourceNames.join(' / ')}
                    </p>
                  ) : null}
                  {category.preferredTopicLabels?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      偏好主题：{category.preferredTopicLabels.join(' / ')}
                    </p>
                  ) : null}
                  {category.focusAreas?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">关注面：{category.focusAreas.join(' / ')}</p>
                  ) : null}
                  {category.trendHighlights?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      连续变化：{category.trendHighlights.join('；')}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="space-y-3">
              {records.length === 0 ? (
                <p className="text-sm text-muted-foreground">本轮分类统计已生成，但还没有条目级审计明细。</p>
              ) : (
                records.slice(0, 24).map(record => (
                  <article
                    key={`${record.messageKey}:${record.sourceName}`}
                    className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{record.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {record.categoryTitle} / {record.sourceName}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={record.sent ? 'success' : 'outline'}>{record.sent ? '已发送' : '未发送'}</Badge>
                        <Badge variant={decisionBadgeVariant(record.decisionReason)}>{record.decisionReason}</Badge>
                        {record.updateStatus ? <Badge variant="outline">{record.updateStatus}</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {record.displaySeverity ? <Badge variant="outline">{record.displaySeverity}</Badge> : null}
                      {record.displayScope ? <Badge variant="outline">{record.displayScope}</Badge> : null}
                      {record.relevanceLevel ? (
                        <Badge variant="outline">{relevanceLabel(record.relevanceLevel)}</Badge>
                      ) : null}
                      {record.recommendedAction ? (
                        <Badge variant="outline">{actionLabel(record.recommendedAction)}</Badge>
                      ) : null}
                      <Badge variant="outline">{record.sourceGroup}</Badge>
                      <Badge variant="outline">{record.crossVerified ? '交叉验证' : '单源'}</Badge>
                      <Badge variant="outline">👍 {record.helpful ?? 0}</Badge>
                      <Badge variant="outline">👎 {record.notHelpful ?? 0}</Badge>
                      <Badge variant="outline">{new Date(record.publishedAt).toLocaleString()}</Badge>
                    </div>
                    {record.whyItMatters ? (
                      <p className="mt-3 text-sm text-foreground/90">值得看原因：{record.whyItMatters}</p>
                    ) : null}
                    {record.recommendedNextStep ? (
                      <p className="mt-1 text-sm text-foreground/90">首动作：{record.recommendedNextStep}</p>
                    ) : null}
                    {record.impactScenarioTags?.length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        影响场景：{record.impactScenarioTags.join(' / ')}
                      </p>
                    ) : null}
                    <p className="mt-3 break-all text-xs text-muted-foreground">{record.messageKey}</p>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function relevanceLabel(level: 'immediate' | 'team' | 'watch') {
  if (level === 'immediate') {
    return '立即相关';
  }
  if (level === 'team') {
    return '团队关注';
  }
  return '行业观察';
}

function actionLabel(action: 'ignore' | 'watch' | 'evaluate' | 'pilot' | 'fix-now') {
  if (action === 'fix-now') {
    return '立即处理';
  }
  if (action === 'pilot') {
    return '建议试点';
  }
  if (action === 'evaluate') {
    return '纳入评测';
  }
  if (action === 'watch') {
    return '收藏观察';
  }
  return '可忽略';
}

function decisionBadgeVariant(reason: string) {
  if (reason === 'send_new' || reason === 'critical_override') {
    return 'success';
  }
  if (reason === 'send_update') {
    return 'warning';
  }
  if (reason === 'suppress_duplicate') {
    return 'secondary';
  }
  return 'outline';
}
