import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardEmptyState } from '@/components/dashboard-center-shell';

import type { LearningCenterRecord } from '@/types/admin';
import { LearningCandidatesCard, RecentResearchJobsCard } from './learning-center-record-candidate-sections';

export function LearningRecordSections(props: {
  learning: LearningCenterRecord;
  loading: boolean;
  ruleCandidates: LearningCenterRecord['candidates'];
  onInvalidateMemory: (memoryId: string) => void;
  onSupersedeMemory: (memoryId: string) => void;
  onRestoreMemory: (memoryId: string) => void;
  onRetireMemory: (memoryId: string) => void;
}) {
  const { learning, loading, ruleCandidates, onInvalidateMemory, onSupersedeMemory, onRestoreMemory, onRetireMemory } =
    props;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Learning Queue</CardTitle>
            <Badge variant="outline">{learning.learningQueue?.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!learning.learningQueue?.length ? (
              <DashboardEmptyState message="当前没有排队中的学习任务。" />
            ) : (
              learning.learningQueue.map(item => (
                <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.priority === 'high' ? 'warning' : 'secondary'}>
                      {item.priority ?? 'normal'}
                    </Badge>
                    <Badge variant="outline">{item.status}</Badge>
                    <Badge variant={item.mode === 'dream-task' ? 'secondary' : 'outline'}>
                      {item.mode === 'dream-task' ? 'dream-task' : 'task-learning'}
                    </Badge>
                    {item.selectedCounselorId ? <Badge variant="outline">{item.selectedCounselorId}</Badge> : null}
                    {item.selectedVersion ? <Badge variant="outline">{item.selectedVersion}</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.taskId}</p>
                  {item.summary ? <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p> : null}
                  {item.candidateSummary ? (
                    <p className="mt-1 text-xs text-muted-foreground">候选摘要：{item.candidateSummary}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    tools {item.capabilityUsageStats?.toolCount ?? 0} / workers{' '}
                    {item.capabilityUsageStats?.workerCount ?? 0}
                    {typeof item.capabilityUsageStats?.totalTokens === 'number'
                      ? ` / tokens ${Math.round(item.capabilityUsageStats.totalTokens)}`
                      : ''}
                  </p>
                  {item.mode === 'dream-task' ? (
                    <p className="mt-1 text-xs text-muted-foreground">仅整理候选，不会自动发布 stable skill。</p>
                  ) : null}
                </article>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Counselor Experiments</CardTitle>
            <Badge variant="outline">{learning.counselorExperiments?.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!learning.counselorExperiments?.length ? (
              <DashboardEmptyState message="当前还没有可对比的群辅灰度数据。" />
            ) : (
              learning.counselorExperiments.map(item => (
                <article
                  key={`${item.selectedCounselorId}-${item.selectedVersion}`}
                  className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.selectedCounselorId ?? 'unknown'}</Badge>
                    <Badge variant="outline">{item.selectedVersion ?? 'unversioned'}</Badge>
                    <Badge variant="outline">tasks {item.taskCount}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    success {(item.successRate * 100).toFixed(0)}% / interrupt {(item.interruptRate * 100).toFixed(0)}%
                    / blocked {(item.blockedRate * 100).toFixed(0)}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    avg tokens {Math.round(item.avgTokens)} / avg cost ${item.avgCostUsd.toFixed(3)}
                  </p>
                </article>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Budget Efficiency Warnings</CardTitle>
          <Badge variant="outline">{learning.budgetEfficiencyWarnings?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!learning.budgetEfficiencyWarnings?.length ? (
            <DashboardEmptyState message="当前没有预算效率告警。" />
          ) : (
            learning.budgetEfficiencyWarnings.map(item => (
              <article key={item.taskId} className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">{item.goal}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.taskId}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status ? <Badge variant="warning">{item.status}</Badge> : null}
                  {item.reason ? <Badge variant="outline">{item.reason}</Badge> : null}
                </div>
              </article>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Quarantine Governance</CardTitle>
          <Badge variant="outline">{Object.keys(learning.quarantineCategoryStats ?? {}).length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!Object.keys(learning.quarantineCategoryStats ?? {}).length ? (
            <DashboardEmptyState message="当前还没有隔离分类统计。" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(learning.quarantineCategoryStats ?? {}).map(([category, count]) => (
                <span key={category}>
                  <Badge variant="secondary">
                    {category} {count}
                  </Badge>
                </span>
              ))}
            </div>
          )}
          {learning.quarantineRestoreSuggestions?.length ? (
            <div className="grid gap-2">
              {learning.quarantineRestoreSuggestions.map(suggestion => (
                <p key={suggestion} className="text-xs text-emerald-700">
                  恢复建议：{suggestion}
                </p>
              ))}
            </div>
          ) : null}
          {learning.recentCrossCheckEvidence?.length ? (
            <div className="grid gap-2">
              {learning.recentCrossCheckEvidence.map(item => (
                <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">{item.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.id} / {item.memoryId}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">{item.sourceType}</Badge>
                    <Badge variant="outline">{item.trustClass}</Badge>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Rule Candidates</CardTitle>
          <Badge variant="outline">{ruleCandidates.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {ruleCandidates.length === 0 ? (
            <DashboardEmptyState message="当前还没有待确认的规则候选。" />
          ) : (
            ruleCandidates.slice(0, 8).map(candidate => (
              <article key={candidate.id} className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{candidate.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{candidate.taskGoal}</p>
                  </div>
                  <Badge variant="warning">{candidate.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">rule</Badge>
                  {candidate.currentMinistry ? <Badge variant="secondary">{candidate.currentMinistry}</Badge> : null}
                  {typeof candidate.confidenceScore === 'number' ? (
                    <Badge variant="secondary">score {Math.round(candidate.confidenceScore)}</Badge>
                  ) : null}
                  {candidate.provenanceCount ? (
                    <Badge variant="secondary">evidence {candidate.provenanceCount}</Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  建议先人工确认后再写入正式规则库，避免一次性偶发错误污染运行策略。
                </p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Quarantined Memories</CardTitle>
          <Badge variant="outline">{learning.recentQuarantinedMemories?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!learning.recentQuarantinedMemories?.length ? (
            <DashboardEmptyState message="当前还没有被隔离的经验记忆。" />
          ) : (
            learning.recentQuarantinedMemories.map(memory => (
              <article key={memory.id} className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{memory.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{memory.id}</p>
                  </div>
                  <Badge variant="warning">quarantined</Badge>
                </div>
                {memory.quarantineReason ? (
                  <p className="mt-3 text-xs text-amber-700">{memory.quarantineReason}</p>
                ) : null}
                {memory.quarantineCategory ? (
                  <p className="mt-2 text-xs text-muted-foreground">分类：{memory.quarantineCategory}</p>
                ) : null}
                {memory.quarantineReasonDetail ? (
                  <p className="mt-2 text-xs text-muted-foreground">{memory.quarantineReasonDetail}</p>
                ) : null}
                {memory.quarantineRestoreSuggestion ? (
                  <p className="mt-2 text-xs text-emerald-700">恢复建议：{memory.quarantineRestoreSuggestion}</p>
                ) : null}
                {memory.quarantinedAt ? (
                  <p className="mt-3 text-xs text-muted-foreground">{memory.quarantinedAt}</p>
                ) : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Skill Governance</CardTitle>
          <Badge variant="outline">{learning.recentSkillGovernance?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!learning.recentSkillGovernance?.length ? (
            <DashboardEmptyState message="当前还没有技能治理建议。" />
          ) : (
            learning.recentSkillGovernance.map(item => (
              <article
                key={`${item.taskId}-${item.skillId}`}
                className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.skillId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.goal}</p>
                  </div>
                  <Badge variant="secondary">{item.recommendation}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {typeof item.successRate === 'number' ? (
                    <Badge variant="secondary">success {(item.successRate * 100).toFixed(0)}%</Badge>
                  ) : null}
                  {item.promotionState ? <Badge variant="secondary">{item.promotionState}</Badge> : null}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{item.updatedAt}</p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
      <LearningCandidatesCard candidates={learning.candidates} />
      <RecentResearchJobsCard
        jobs={learning.recentJobs}
        loading={loading}
        onInvalidateMemory={onInvalidateMemory}
        onSupersedeMemory={onSupersedeMemory}
        onRestoreMemory={onRestoreMemory}
        onRetireMemory={onRetireMemory}
      />
    </>
  );
}
