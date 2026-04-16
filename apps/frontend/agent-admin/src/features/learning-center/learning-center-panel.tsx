import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DashboardCenterShell, DashboardMetricGrid } from '@/components/dashboard-center-shell';

import type { LearningCenterRecord } from '@/types/admin';

import { LearningChartsCard } from './learning-center-charts-card';
import { LearningOperationsSections } from './learning-center-operations-sections';
import {
  buildConflictData,
  buildMinistryScoreData,
  buildQueueModeData,
  buildTrustDistributionData,
  filterCounselorSelectors,
  getRuleCandidates,
  type LearningChartKey
} from './learning-center-panel-support';
import { LearningRecordSections } from './learning-center-record-sections';
import { LearningSummarySections } from './learning-center-summary-sections';

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
  const [activeChart, setActiveChart] = useState<LearningChartKey>('queue');
  const [selectorDomainFilter, setSelectorDomainFilter] = useState('');
  const [selectorFeatureFlagFilter, setSelectorFeatureFlagFilter] = useState('');

  const filteredSelectors = useMemo(
    () => filterCounselorSelectors(learning.counselorSelectorConfigs, selectorDomainFilter, selectorFeatureFlagFilter),
    [learning.counselorSelectorConfigs, selectorDomainFilter, selectorFeatureFlagFilter]
  );
  const queueModeData = useMemo(() => buildQueueModeData(learning), [learning]);
  const conflictData = useMemo(() => buildConflictData(learning), [learning]);
  const ministryScoreData = useMemo(() => buildMinistryScoreData(learning), [learning]);
  const trustDistributionData = useMemo(() => buildTrustDistributionData(learning), [learning]);
  const ruleCandidates = useMemo(() => getRuleCandidates(learning), [learning]);

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
      <LearningSummarySections learning={learning} />
      <LearningOperationsSections
        learning={learning}
        loading={loading}
        filteredSelectors={filteredSelectors}
        selectorDomainFilter={selectorDomainFilter}
        onSelectorDomainFilterChange={setSelectorDomainFilter}
        selectorFeatureFlagFilter={selectorFeatureFlagFilter}
        onSelectorFeatureFlagFilterChange={setSelectorFeatureFlagFilter}
        onEditCounselorSelector={onEditCounselorSelector}
        onEnableCounselorSelector={onEnableCounselorSelector}
        onDisableCounselorSelector={onDisableCounselorSelector}
        onSetLearningConflictStatus={onSetLearningConflictStatus}
      />
      <LearningRecordSections
        learning={learning}
        loading={loading}
        ruleCandidates={ruleCandidates}
        onInvalidateMemory={onInvalidateMemory}
        onSupersedeMemory={onSupersedeMemory}
        onRestoreMemory={onRestoreMemory}
        onRetireMemory={onRetireMemory}
      />
    </DashboardCenterShell>
  );
}
