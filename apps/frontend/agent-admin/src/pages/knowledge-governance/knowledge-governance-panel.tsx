import { LoaderCircle, RefreshCw } from 'lucide-react';

import { DashboardCenterShell, DashboardEmptyState } from '@/components/dashboard-center-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { KnowledgeGovernanceDiagnostics } from './knowledge-governance-diagnostics';
import { KnowledgeGovernanceFlowCanvas } from './knowledge-governance-flow-canvas';
import { KnowledgeGovernanceSummary } from './knowledge-governance-summary';
import type { KnowledgeGovernanceProjection } from './knowledge-governance-types';

export function KnowledgeGovernancePanel({
  projection,
  loading,
  error,
  onRefresh
}: {
  error?: string | null;
  projection: KnowledgeGovernanceProjection | null;
  loading: boolean;
  onRefresh?: () => void;
}) {
  return (
    <DashboardCenterShell
      title="知识治理"
      description="治理知识库健康、ingestion 来源、检索诊断、证据链和 agent 使用情况。"
      count={projection ? `${projection.summary.knowledgeBaseCount} 知识库` : '加载中'}
      actions={
        <div className="flex items-center gap-2">
          {projection ? <Badge variant="outline">更新于 {projection.updatedAt}</Badge> : null}
          {onRefresh ? (
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={onRefresh}>
              {loading ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              )}
              刷新
            </Button>
          ) : null}
        </div>
      }
    >
      {error ? (
        <DashboardEmptyState className="border-destructive/30 bg-destructive/5 text-destructive" message={error} />
      ) : null}
      {projection ? (
        <div className="grid gap-4">
          <KnowledgeGovernanceSummary projection={projection} />
          <KnowledgeGovernanceFlowCanvas projection={projection} />
          <KnowledgeGovernanceDiagnostics projection={projection} />
        </div>
      ) : (
        <DashboardEmptyState message={loading ? '正在加载知识治理投影。' : '暂无知识治理投影。'} />
      )}
    </DashboardCenterShell>
  );
}
