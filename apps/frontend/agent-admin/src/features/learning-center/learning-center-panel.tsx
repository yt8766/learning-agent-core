import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import {
  DashboardCenterShell,
  DashboardEmptyState,
  DashboardMetricGrid,
  DashboardToolbar
} from '@/components/dashboard-center-shell';

import type { LearningCenterRecord } from '@/types/admin';

interface LearningCenterPanelProps {
  learning: LearningCenterRecord;
  loading: boolean;
  onInvalidateMemory: (memoryId: string) => void;
  onSupersedeMemory: (memoryId: string) => void;
  onRestoreMemory: (memoryId: string) => void;
  onRetireMemory: (memoryId: string) => void;
  onCreateCounselorSelector: () => void;
  onEditCounselorSelector: (selector: NonNullable<LearningCenterRecord['counselorSelectorConfigs']>[number]) => void;
  onEnableCounselorSelector: (selectorId: string) => void;
  onDisableCounselorSelector: (selectorId: string) => void;
  onSetLearningConflictStatus: (
    conflictId: string,
    status: 'open' | 'merged' | 'dismissed' | 'escalated',
    preferredMemoryId?: string
  ) => void;
}

export function LearningCenterPanel({
  learning,
  loading,
  onInvalidateMemory,
  onSupersedeMemory,
  onRestoreMemory,
  onRetireMemory,
  onCreateCounselorSelector,
  onEditCounselorSelector,
  onEnableCounselorSelector,
  onDisableCounselorSelector,
  onSetLearningConflictStatus
}: LearningCenterPanelProps) {
  const ruleCandidates = learning.candidates.filter(candidate => candidate.type === 'rule');
  const [activeChart, setActiveChart] = useState<'queue' | 'conflict' | 'ministry' | 'trust'>('queue');
  const [selectorDomainFilter, setSelectorDomainFilter] = useState('');
  const [selectorFeatureFlagFilter, setSelectorFeatureFlagFilter] = useState('');
  const filteredSelectors = useMemo(
    () =>
      (learning.counselorSelectorConfigs ?? []).filter(item => {
        const domainMatched =
          !selectorDomainFilter || item.domain.toLowerCase().includes(selectorDomainFilter.toLowerCase());
        const featureFlagMatched =
          !selectorFeatureFlagFilter ||
          (item.featureFlag ?? '').toLowerCase().includes(selectorFeatureFlagFilter.toLowerCase());
        return domainMatched && featureFlagMatched;
      }),
    [learning.counselorSelectorConfigs, selectorDomainFilter, selectorFeatureFlagFilter]
  );
  const queueModeData = useMemo(() => {
    const summary = learning.learningQueueSummary?.byMode;
    if (summary) {
      return [
        { key: 'taskLearning', label: 'task-learning', value: summary.taskLearning.total },
        { key: 'dreamTask', label: 'dream-task', value: summary.dreamTask.total }
      ];
    }

    if (learning.learningQueue?.length) {
      const taskLearning = learning.learningQueue.filter(item => item.mode !== 'dream-task').length;
      const dreamTask = learning.learningQueue.filter(item => item.mode === 'dream-task').length;
      return [
        { key: 'taskLearning', label: 'task-learning', value: taskLearning },
        { key: 'dreamTask', label: 'dream-task', value: dreamTask }
      ];
    }

    return [
      {
        key: 'taskLearning',
        label: 'task-learning',
        value:
          (learning.learningQueueSummary?.taskLearningQueued ?? 0) +
          (learning.learningQueueSummary?.taskLearningProcessing ?? 0) +
          (learning.learningQueueSummary?.taskLearningCompleted ?? 0)
      },
      {
        key: 'dreamTask',
        label: 'dream-task',
        value:
          (learning.learningQueueSummary?.dreamTaskQueued ?? 0) +
          (learning.learningQueueSummary?.dreamTaskProcessing ?? 0) +
          (learning.learningQueueSummary?.dreamTaskCompleted ?? 0)
      }
    ];
  }, [learning.learningQueue, learning.learningQueueSummary]);
  const conflictData = useMemo(
    () => [
      { key: 'open', label: 'open', value: learning.conflictGovernance?.open ?? 0 },
      { key: 'merged', label: 'merged', value: learning.conflictGovernance?.merged ?? 0 },
      { key: 'dismissed', label: 'dismissed', value: learning.conflictGovernance?.dismissed ?? 0 },
      { key: 'escalated', label: 'escalated', value: learning.conflictGovernance?.escalated ?? 0 }
    ],
    [learning.conflictGovernance]
  );
  const ministryScoreData = useMemo(
    () =>
      (learning.ministryScorecards ?? []).map(item => ({
        ministry: item.ministry,
        score: Number((item.averageScore ?? 0).toFixed(1))
      })),
    [learning.ministryScorecards]
  );
  const trustDistributionData = useMemo(() => {
    const result = { high: 0, medium: 0, low: 0 };
    for (const item of learning.capabilityTrustProfiles ?? []) {
      result[item.trustLevel] += 1;
    }
    return [
      { key: 'high', label: 'high', value: result.high },
      { key: 'medium', label: 'medium', value: result.medium },
      { key: 'low', label: 'low', value: result.low }
    ];
  }, [learning.capabilityTrustProfiles]);

  return (
    <DashboardCenterShell
      title="Learning Center"
      description="治理 learning queue、冲突扫描、RLAIF 评分卡与群辅 selector，让学习沉淀真正可观察可干预。"
      count={learning.totalCandidates}
      actions={
        <Button size="sm" variant="outline" onClick={onCreateCounselorSelector} disabled={loading}>
          新建 selector
        </Button>
      }
    >
      <DashboardMetricGrid
        columns="md:grid-cols-2 xl:grid-cols-4"
        items={[
          { label: '总候选', value: learning.totalCandidates },
          { label: '待确认', value: learning.pendingCandidates },
          { label: '已确认', value: learning.confirmedCandidates },
          { label: '研究任务', value: learning.researchJobs ?? 0 },
          { label: '学习队列', value: learning.queuedLearningTasks ?? 0 },
          { label: '超时任务', value: learning.timeoutStats?.timedOutTaskCount ?? 0 },
          { label: '默认采用', value: learning.timeoutStats?.defaultAppliedCount ?? 0 },
          { label: '可自动沉淀', value: learning.autoConfirmableCandidates ?? 0 },
          { label: '已自动沉淀研究', value: learning.autoPersistedResearchJobs ?? 0 },
          { label: '研究冲突', value: learning.conflictingResearchJobs ?? 0 },
          { label: '失效记忆', value: learning.invalidatedMemories ?? 0 },
          { label: '隔离记忆', value: learning.quarantinedMemories ?? 0 },
          { label: '失效规则', value: learning.invalidatedRules ?? 0 },
          { label: '平均评估分', value: Math.round(learning.averageEvaluationScore ?? 0) }
        ]}
      />
      <LearningChartsCard
        activeChart={activeChart}
        onChartChange={setActiveChart}
        queueModeData={queueModeData}
        conflictData={conflictData}
        ministryScoreData={ministryScoreData}
        trustDistributionData={trustDistributionData}
      />
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
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold text-foreground">Counselor Selector Configs</CardTitle>
              <p className="text-xs text-muted-foreground">管理群辅灰度 selector 的启停、fallback 和分流策略。</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <DashboardToolbar title="Selector Filters">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={selectorDomainFilter}
                  onChange={event => setSelectorDomainFilter(event.target.value)}
                  placeholder="按 domain 过滤"
                />
                <Input
                  value={selectorFeatureFlagFilter}
                  onChange={event => setSelectorFeatureFlagFilter(event.target.value)}
                  placeholder="按 feature flag 过滤"
                />
              </div>
            </DashboardToolbar>
            {!filteredSelectors.length ? (
              <DashboardEmptyState message="当前还没有持久化的群辅 selector 配置。" />
            ) : (
              filteredSelectors.map(item => (
                <article key={item.selectorId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.enabled ? 'secondary' : 'outline'}>
                      {item.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                    <Badge variant="outline">{item.strategy}</Badge>
                    <Badge variant="outline">{item.domain}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.selectorId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    default {item.defaultCounselorId}
                    {item.featureFlag ? ` / flag ${item.featureFlag}` : ''}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.candidateIds.join(' / ')}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditCounselorSelector(item)}
                      disabled={loading}
                    >
                      编辑
                    </Button>
                    {item.enabled ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDisableCounselorSelector(item.selectorId)}
                        disabled={loading}
                      >
                        停用
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEnableCounselorSelector(item.selectorId)}
                        disabled={loading}
                      >
                        启用
                      </Button>
                    )}
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Learning Conflict Scan</CardTitle>
            <Badge variant="outline">{learning.learningConflictScan?.conflictPairs.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            {learning.learningConflictScan?.scannedAt ? (
              <p className="text-xs text-muted-foreground">last scanned {learning.learningConflictScan.scannedAt}</p>
            ) : null}
            {learning.learningConflictScan?.mergeSuggestions.length ? (
              <div className="grid gap-3">
                {learning.learningConflictScan.mergeSuggestions.map(item => (
                  <article
                    key={item.conflictId}
                    className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-foreground">{item.conflictId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.suggestion}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.loserMemoryIds.join(' / ')}</p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSetLearningConflictStatus(item.conflictId, 'merged', item.preferredMemoryId)}
                        disabled={loading}
                      >
                        接受合并建议
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onSetLearningConflictStatus(item.conflictId, 'escalated', item.preferredMemoryId)
                        }
                        disabled={loading}
                      >
                        升级处理
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            {!learning.learningConflictScan?.conflictPairs.length ? (
              <DashboardEmptyState message="当前没有检测到需要治理的经验冲突。" />
            ) : (
              learning.learningConflictScan.conflictPairs.map(item => (
                <article key={item.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{item.recommendation}</Badge>
                    {item.riskLevel ? <Badge variant="outline">{item.riskLevel}</Badge> : null}
                    <Badge variant="secondary">spread {item.effectivenessSpread.toFixed(2)}</Badge>
                    {item.status ? <Badge variant="outline">{item.status}</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.contextSignature}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.memoryIds.join(' / ')}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSetLearningConflictStatus(item.id, 'dismissed')}
                      disabled={loading}
                    >
                      挂起
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSetLearningConflictStatus(item.id, 'open')}
                      disabled={loading}
                    >
                      重新打开
                    </Button>
                  </div>
                </article>
              ))
            )}
            {learning.learningConflictScan?.manualReviewQueue.length ? (
              <div className="grid gap-2">
                {learning.learningConflictScan.manualReviewQueue.map(item => (
                  <article key={item.id} className="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-4">
                    <p className="text-xs text-amber-700">
                      manual review: {item.contextSignature} / {item.resolution}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSetLearningConflictStatus(item.id, 'merged', item.preferredMemoryId)}
                        disabled={loading}
                      >
                        标记已完成
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSetLearningConflictStatus(item.id, 'escalated', item.preferredMemoryId)}
                        disabled={loading}
                      >
                        升级
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
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
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Learning Candidates</CardTitle>
          <Badge variant="outline">{learning.candidates.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {learning.candidates.length === 0 ? (
            <DashboardEmptyState message="当前没有学习候选。" />
          ) : (
            learning.candidates.map(candidate => (
              <article key={candidate.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{candidate.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{candidate.taskGoal}</p>
                  </div>
                  <Badge variant={candidate.status === 'confirmed' ? 'success' : 'warning'}>{candidate.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">{candidate.type}</Badge>
                  {candidate.currentMinistry ? <Badge variant="secondary">{candidate.currentMinistry}</Badge> : null}
                  {candidate.currentWorker ? <Badge variant="secondary">{candidate.currentWorker}</Badge> : null}
                  {candidate.evaluationConfidence ? (
                    <Badge variant="secondary">{candidate.evaluationConfidence}</Badge>
                  ) : null}
                  {typeof candidate.confidenceScore === 'number' ? (
                    <Badge variant="secondary">score {Math.round(candidate.confidenceScore)}</Badge>
                  ) : null}
                  {candidate.provenanceCount ? (
                    <Badge variant="secondary">sources {candidate.provenanceCount}</Badge>
                  ) : null}
                  {candidate.autoConfirmEligible ? <Badge variant="success">auto-confirm</Badge> : null}
                  {(candidate.expertiseSignals ?? []).map(signal => (
                    <span key={`${candidate.id}-${signal}`}>
                      <Badge variant="outline">{signal}</Badge>
                    </span>
                  ))}
                  {candidate.policyMode ? <Badge variant="outline">{candidate.policyMode}</Badge> : null}
                </div>
                {candidate.candidateReasons?.length ? (
                  <p className="mt-3 text-xs text-emerald-700">{candidate.candidateReasons.join('；')}</p>
                ) : null}
                {candidate.skippedReasons?.length ? (
                  <p className="mt-2 text-xs text-amber-700">{candidate.skippedReasons.join('；')}</p>
                ) : null}
                {candidate.conflictDetected ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="destructive">conflict</Badge>
                    {(candidate.conflictTargets ?? []).map(target => (
                      <span key={`${candidate.id}-${target}`}>
                        <Badge variant="outline">{target}</Badge>
                      </span>
                    ))}
                    {(candidate.derivedFromLayers ?? []).map(layer => (
                      <span key={`${candidate.id}-${layer}`}>
                        <Badge variant="secondary">{layer}</Badge>
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">{candidate.createdAt}</p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
      <Card className="border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Recent Research Jobs</CardTitle>
          <Badge variant="outline">{learning.recentJobs?.length ?? 0}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!learning.recentJobs?.length ? (
            <DashboardEmptyState message="当前还没有主动研究任务。" />
          ) : (
            learning.recentJobs.map(job => (
              <article key={job.id} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {job.summary ?? job.goal ?? job.documentUri}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{job.goal ?? job.documentUri}</p>
                  </div>
                  <Badge variant={job.status === 'completed' ? 'success' : 'warning'}>{job.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">{job.sourceType}</Badge>
                  {job.workflowId ? <Badge variant="secondary">{job.workflowId}</Badge> : null}
                  {job.sourceCount ? <Badge variant="secondary">sources {job.sourceCount}</Badge> : null}
                  {typeof job.evaluationScore === 'number' ? (
                    <Badge variant="secondary">score {Math.round(job.evaluationScore)}</Badge>
                  ) : null}
                  {job.evaluationConfidence ? <Badge variant="secondary">{job.evaluationConfidence}</Badge> : null}
                  {job.autoPersistEligible ? <Badge variant="success">auto-persisted</Badge> : null}
                  {job.conflictDetected ? <Badge variant="destructive">conflict</Badge> : null}
                  {(job.expertiseSignals ?? []).map(signal => (
                    <span key={`${job.id}-${signal}`}>
                      <Badge variant="outline">{signal}</Badge>
                    </span>
                  ))}
                  {Object.entries(job.trustSummary ?? {}).map(([trustClass, count]) => (
                    <span key={`${job.id}-${trustClass}`}>
                      <Badge variant="secondary">
                        {trustClass} {count}
                      </Badge>
                    </span>
                  ))}
                </div>
                {job.persistedMemoryIds?.length ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-emerald-600">已自动沉淀 memory：</p>
                    {job.persistedMemoryIds.map(memoryId => (
                      <span key={`${job.id}-${memoryId}`} className="inline-flex items-center gap-2">
                        <Badge variant="outline">{memoryId}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => onInvalidateMemory(memoryId)}
                        >
                          失效
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => onSupersedeMemory(memoryId)}
                        >
                          替代
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading}
                          onClick={() => onRestoreMemory(memoryId)}
                        >
                          恢复
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={loading}
                          onClick={() => onRetireMemory(memoryId)}
                        >
                          归档
                        </Button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {job.candidateReasons?.length ? (
                  <p className="mt-3 text-xs text-emerald-700">{job.candidateReasons.join('；')}</p>
                ) : null}
                {job.skippedReasons?.length ? (
                  <p className="mt-2 text-xs text-amber-700">{job.skippedReasons.join('；')}</p>
                ) : null}
                {job.conflictNotes?.length ? (
                  <p className="mt-3 text-xs text-red-600">{job.conflictNotes.join('；')}</p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">{job.updatedAt}</p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardCenterShell>
  );
}

const learningQueueConfig = {
  taskLearning: { label: 'task-learning', color: 'var(--chart-1)' },
  dreamTask: { label: 'dream-task', color: 'var(--chart-2)' }
} satisfies ChartConfig;

const learningConflictConfig = {
  open: { label: 'open', color: 'var(--chart-3)' },
  merged: { label: 'merged', color: 'var(--chart-1)' },
  dismissed: { label: 'dismissed', color: 'var(--chart-4)' },
  escalated: { label: 'escalated', color: 'var(--chart-5)' }
} satisfies ChartConfig;

const learningMinistryConfig = {
  score: { label: 'Average Score', color: 'var(--chart-2)' }
} satisfies ChartConfig;

const learningTrustConfig = {
  high: { label: 'high', color: 'var(--chart-1)' },
  medium: { label: 'medium', color: 'var(--chart-3)' },
  low: { label: 'low', color: 'var(--chart-5)' }
} satisfies ChartConfig;

function LearningChartsCard({
  activeChart,
  onChartChange,
  queueModeData,
  conflictData,
  ministryScoreData,
  trustDistributionData
}: {
  activeChart: 'queue' | 'conflict' | 'ministry' | 'trust';
  onChartChange: (value: 'queue' | 'conflict' | 'ministry' | 'trust') => void;
  queueModeData: Array<{ key: string; label: string; value: number }>;
  conflictData: Array<{ key: string; label: string; value: number }>;
  ministryScoreData: Array<{ ministry: string; score: number }>;
  trustDistributionData: Array<{ key: string; label: string; value: number }>;
}) {
  const meta = {
    queue: {
      title: 'Learning Queue Structure',
      description: '查看 task-learning 与 dream-task 的沉淀结构。',
      empty: '当前还没有可视化的学习队列结构。'
    },
    conflict: {
      title: 'Conflict Governance',
      description: '查看冲突治理压力和处理结果分布。',
      empty: '当前没有可视化的冲突治理数据。'
    },
    ministry: {
      title: 'Ministry Scorecards',
      description: '查看六部长期治理分数。',
      empty: '当前还没有 ministry 评分数据。'
    },
    trust: {
      title: 'Capability Trust Distribution',
      description: '查看 capability trust 的层级分布。',
      empty: '当前还没有 capability trust 分布。'
    }
  }[activeChart];

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="gap-4 border-b border-[#ecece8] pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold text-foreground">{meta.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeChart === 'queue' ? 'default' : 'ghost'}
            onClick={() => onChartChange('queue')}
          >
            Queue
          </Button>
          <Button
            size="sm"
            variant={activeChart === 'conflict' ? 'default' : 'ghost'}
            onClick={() => onChartChange('conflict')}
          >
            Conflict
          </Button>
          <Button
            size="sm"
            variant={activeChart === 'ministry' ? 'default' : 'ghost'}
            onClick={() => onChartChange('ministry')}
          >
            Ministry
          </Button>
          <Button
            size="sm"
            variant={activeChart === 'trust' ? 'default' : 'ghost'}
            onClick={() => onChartChange('trust')}
          >
            Trust
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {activeChart === 'queue' ? (
          queueModeData.some(item => item.value > 0) ? (
            <ChartContainer config={learningQueueConfig}>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toLocaleString()} />} />
                <Pie
                  data={queueModeData}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={72}
                  outerRadius={112}
                  paddingAngle={4}
                >
                  {queueModeData.map(item => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <DashboardEmptyState message={meta.empty} />
          )
        ) : null}

        {activeChart === 'conflict' ? (
          conflictData.some(item => item.value > 0) ? (
            <ChartContainer config={learningConflictConfig}>
              <BarChart data={conflictData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={56} />
                <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toLocaleString()} />} />
                <Bar dataKey="value" radius={[10, 10, 4, 4]}>
                  {conflictData.map(item => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <DashboardEmptyState message={meta.empty} />
          )
        ) : null}

        {activeChart === 'ministry' ? (
          ministryScoreData.length ? (
            <ChartContainer config={learningMinistryConfig}>
              <RadarChart data={ministryScoreData} outerRadius={110}>
                <PolarGrid />
                <PolarAngleAxis dataKey="ministry" tick={{ fill: 'var(--muted-foreground)' }} />
                <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toFixed(1)} />} />
                <Radar dataKey="score" fill="var(--color-score)" fillOpacity={0.28} stroke="var(--color-score)" />
              </RadarChart>
            </ChartContainer>
          ) : (
            <DashboardEmptyState message={meta.empty} />
          )
        ) : null}

        {activeChart === 'trust' ? (
          trustDistributionData.some(item => item.value > 0) ? (
            <ChartContainer config={learningTrustConfig}>
              <BarChart data={trustDistributionData} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={56} />
                <ChartTooltip content={<ChartTooltipContent formatter={value => Number(value).toLocaleString()} />} />
                <Bar dataKey="value" radius={[10, 10, 4, 4]}>
                  {trustDistributionData.map(item => (
                    <Cell key={item.key} fill={`var(--color-${item.key})`} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <DashboardEmptyState message={meta.empty} />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function GovernanceProfileCard({
  title,
  profiles,
  emptyMessage
}: {
  title: string;
  profiles:
    | LearningCenterRecord['ministryGovernanceProfiles']
    | LearningCenterRecord['workerGovernanceProfiles']
    | LearningCenterRecord['specialistGovernanceProfiles'];
  emptyMessage: string;
}) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
        <Badge variant="outline">{profiles?.length ?? 0}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!profiles?.length ? (
          <DashboardEmptyState message={emptyMessage} />
        ) : (
          profiles.slice(0, 8).map(item => (
            <article key={item.entityId} className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{item.trustLevel}</Badge>
                <Badge variant="secondary">{item.trustTrend}</Badge>
                {typeof item.reportCount === 'number' ? (
                  <Badge variant="outline">{item.reportCount} reports</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">{item.displayName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.entityId}</p>
              {(item.promoteCount ?? item.holdCount ?? item.downgradeCount) !== undefined ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  promote {item.promoteCount ?? 0} / hold {item.holdCount ?? 0} / downgrade {item.downgradeCount ?? 0}
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
  );
}
