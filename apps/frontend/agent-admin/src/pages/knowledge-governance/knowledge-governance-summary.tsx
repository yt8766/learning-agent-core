import { DashboardMetricGrid } from '@/components/dashboard-center-shell';

import type { KnowledgeGovernanceProjection } from './knowledge-governance-types';

export function KnowledgeGovernanceSummary({ projection }: { projection: KnowledgeGovernanceProjection }) {
  const { summary } = projection;

  return (
    <DashboardMetricGrid
      items={[
        {
          label: '知识库',
          value: summary.knowledgeBaseCount,
          note: '纳入治理投影的知识库数量'
        },
        {
          label: '文档',
          value: summary.documentCount,
          note: `${summary.readyDocumentCount} 个文档可用于检索`
        },
        {
          label: '失败任务',
          value: summary.failedJobCount,
          note: 'ingestion 与索引链路的失败计数'
        },
        {
          label: '治理告警',
          value: summary.warningCount,
          note: 'Provider、来源和检索诊断的风险信号'
        }
      ]}
    />
  );
}
