import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { LearningCenterRecord } from '@/types/admin';

import { GovernanceProfileCard } from './learning-center-governance-profile-card';

export function LearningSummarySections({ learning }: { learning: LearningCenterRecord }) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Wenyuan / Cangjing</CardTitle>
            <Badge variant="outline">
              {(learning.knowledgeStores?.wenyuan ? 1 : 0) + (learning.knowledgeStores?.cangjing ? 1 : 0)}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            {learning.knowledgeStores?.wenyuan ? (
              <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                <p className="font-medium text-foreground">文渊阁</p>
                <p className="mt-1">memory {learning.knowledgeStores.wenyuan.memoryCount}</p>
                <p>sessions {learning.knowledgeStores.wenyuan.sessionCount}</p>
                <p>checkpoints {learning.knowledgeStores.wenyuan.checkpointCount}</p>
                <p>trace {learning.knowledgeStores.wenyuan.traceCount}</p>
              </article>
            ) : null}
            {learning.knowledgeStores?.cangjing ? (
              <article className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                <p className="font-medium text-foreground">藏经阁</p>
                <p className="mt-1">sources {learning.knowledgeStores.cangjing.sourceCount}</p>
                <p>chunks {learning.knowledgeStores.cangjing.chunkCount}</p>
                <p>embeddings {learning.knowledgeStores.cangjing.embeddingCount}</p>
                <p>
                  searchable {learning.knowledgeStores.cangjing.searchableDocumentCount} / blocked{' '}
                  {learning.knowledgeStores.cangjing.blockedDocumentCount}
                </p>
              </article>
            ) : null}
            {!learning.knowledgeStores?.wenyuan && !learning.knowledgeStores?.cangjing ? (
              <DashboardEmptyState message="当前还没有文渊阁 / 藏经阁治理摘要。" />
            ) : null}
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Learning Queue Summary</CardTitle>
            <Badge variant="outline">
              {learning.learningQueueSummary?.queued ?? learning.learningQueue?.length ?? 0}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>queued {learning.learningQueueSummary?.queued ?? 0}</p>
            <p>processing {learning.learningQueueSummary?.processing ?? 0}</p>
            <p>blocked {learning.learningQueueSummary?.blocked ?? 0}</p>
            <p>completed {learning.learningQueueSummary?.completed ?? 0}</p>
            <p>task-learning queued {learning.learningQueueSummary?.taskLearningQueued ?? 0}</p>
            <p>dream-task queued {learning.learningQueueSummary?.dreamTaskQueued ?? 0}</p>
            <p>dream-task completed {learning.learningQueueSummary?.dreamTaskCompleted ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Conflict Governance</CardTitle>
            <Badge variant="outline">
              {learning.conflictGovernance?.open ?? learning.learningConflictScan?.conflictPairs.length ?? 0}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>open {learning.conflictGovernance?.open ?? 0}</p>
            <p>merged {learning.conflictGovernance?.merged ?? 0}</p>
            <p>dismissed {learning.conflictGovernance?.dismissed ?? 0}</p>
            <p>escalated {learning.conflictGovernance?.escalated ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">RLAIF / Ministry Scorecards</CardTitle>
            <Badge variant="outline">{learning.ministryScorecards?.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!learning.ministryScorecards?.length ? (
              <DashboardEmptyState message="当前还没有吏部评分卡与 RLAIF 汇总。" />
            ) : (
              learning.ministryScorecards.map(item => (
                <article key={item.ministry} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{item.ministry}</p>
                    <Badge variant="secondary">{item.reportCount} reports</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    average score {typeof item.averageScore === 'number' ? item.averageScore.toFixed(1) : 'N/A'}
                  </p>
                  {item.lastUpdatedAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">{item.lastUpdatedAt}</p>
                  ) : null}
                </article>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Governance Reports</CardTitle>
            <Badge variant="outline">{learning.recentGovernanceReports?.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!learning.recentGovernanceReports?.length ? (
              <DashboardEmptyState message="当前还没有结构化治理报告。" />
            ) : (
              learning.recentGovernanceReports.map(item => (
                <article key={item.taskId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{item.reviewDecision}</Badge>
                    <Badge variant="secondary">{item.trustAdjustment}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.taskId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    evidence {item.evidenceScore} / sandbox {item.sandboxScore}
                  </p>
                </article>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Capability Trust</CardTitle>
            <Badge variant="outline">{learning.capabilityTrustProfiles?.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!learning.capabilityTrustProfiles?.length ? (
              <DashboardEmptyState message="当前还没有 capability trust 画像。" />
            ) : (
              learning.capabilityTrustProfiles.slice(0, 8).map(item => (
                <article key={item.capabilityId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{item.trustLevel}</Badge>
                    <Badge variant="secondary">{item.trustTrend}</Badge>
                    {typeof item.reportCount === 'number' ? (
                      <Badge variant="outline">{item.reportCount} reports</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.capabilityId}</p>
                  {typeof item.promoteCount === 'number' ||
                  typeof item.holdCount === 'number' ||
                  typeof item.downgradeCount === 'number' ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      promote {item.promoteCount ?? 0} / hold {item.holdCount ?? 0} / downgrade{' '}
                      {item.downgradeCount ?? 0}
                    </p>
                  ) : null}
                  {item.lastTaskId ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      latest {item.lastTaskId}
                      {item.lastReviewDecision ? ` / ${item.lastReviewDecision}` : ''}
                    </p>
                  ) : null}
                  {item.lastReason ? <p className="mt-1 text-xs text-muted-foreground">{item.lastReason}</p> : null}
                </article>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <GovernanceProfileCard
          title="Ministry Governance"
          profiles={learning.ministryGovernanceProfiles}
          emptyMessage="当前还没有 ministry 长期治理画像。"
        />
        <GovernanceProfileCard
          title="Worker Governance"
          profiles={learning.workerGovernanceProfiles}
          emptyMessage="当前还没有 worker 长期治理画像。"
        />
        <GovernanceProfileCard
          title="Specialist Governance"
          profiles={learning.specialistGovernanceProfiles}
          emptyMessage="当前还没有 specialist 长期治理画像。"
        />
      </div>
    </>
  );
}
