import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';

import type { ConnectorRecord } from '@/types/admin';

export function ConnectorsCenterSummary({ connectors }: { connectors: ConnectorRecord[] }) {
  const successRates = connectors
    .map(item => item.successRate)
    .filter((value): value is number => typeof value === 'number');
  const avgSuccessRate = successRates.length
    ? successRates.reduce((sum, value) => sum + value, 0) / successRates.length
    : undefined;
  const governedCapabilityCount = connectors.reduce(
    (sum, connector) =>
      sum +
      connector.capabilities.filter(
        capability => capability.effectiveApprovalMode && capability.effectiveApprovalMode !== 'default'
      ).length,
    0
  );
  const totalConnectorUsage = connectors.reduce((sum, connector) => sum + (connector.totalTaskCount ?? 0), 0);
  const knowledgeIngestion = connectors[0]?.knowledgeIngestion;
  const topPerformers = connectors
    .filter(connector => typeof connector.successRate === 'number')
    .slice()
    .sort((left, right) => (right.successRate ?? 0) - (left.successRate ?? 0))
    .slice(0, 3);
  const needsAttention = connectors
    .filter(
      connector =>
        connector.recentFailureReason || (connector.successRate ?? 1) < 0.6 || connector.healthState !== 'healthy'
    )
    .slice()
    .sort((left, right) => (left.successRate ?? 1) - (right.successRate ?? 1))
    .slice(0, 3);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryMetric
          label="Connector Effectiveness"
          value={avgSuccessRate == null ? 'N/A' : `${Math.round(avgSuccessRate * 100)}%`}
          description="连接器平均成功率。"
        />
        <SummaryMetric
          label="Capability Governance"
          value={governedCapabilityCount}
          description="已有单独策略的 capability 数量。"
        />
        <SummaryMetric label="Connector Usage" value={totalConnectorUsage} description="连接器参与过的任务总次数。" />
      </div>
      {knowledgeIngestion ? (
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryMetric
            label="Manifest Ingestion"
            value={knowledgeIngestion.sourceCount}
            description="藏经阁已登记的本地 manifest / docs 来源数量。"
          />
          <SummaryMetric
            label="Searchable Docs"
            value={knowledgeIngestion.searchableDocumentCount}
            description="当前可检索的藏经阁文档数。"
          />
          <SummaryMetric
            label="Blocked Docs"
            value={knowledgeIngestion.blockedDocumentCount}
            description="embedding 失败、暂不可检索的文档数。"
          />
        </div>
      ) : null}
      {topPerformers.length || needsAttention.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ConnectorHighlightList
            title="Top Performers"
            emptyText="当前还没有足够运行数据。"
            items={topPerformers.map(connector => ({
              id: `top-${connector.id}`,
              name: connector.displayName,
              badge: <Badge variant="success">{Math.round((connector.successRate ?? 0) * 100)}%</Badge>,
              detail: `used ${connector.totalTaskCount ?? 0} · capabilities ${connector.capabilityCount}`
            }))}
          />
          <ConnectorHighlightList
            title="Needs Attention"
            emptyText="当前没有明显异常 connector。"
            items={needsAttention.map(connector => ({
              id: `attention-${connector.id}`,
              name: connector.displayName,
              badge: (
                <Badge variant={connector.healthState === 'healthy' ? 'warning' : 'destructive'}>
                  {connector.healthState}
                </Badge>
              ),
              detail: `success ${
                connector.successRate == null ? 'N/A' : `${Math.round(connector.successRate * 100)}%`
              }`,
              note: connector.recentFailureReason
            }))}
          />
        </div>
      ) : null}
    </>
  );
}

function SummaryMetric(props: { label: string; value: number | string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{props.label}</p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{props.value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{props.description}</p>
    </div>
  );
}

function ConnectorHighlightList(props: {
  title: string;
  emptyText: string;
  items: Array<{ id: string; name: string; badge: ReactNode; detail: string; note?: string | null }>;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{props.title}</p>
      <div className="mt-3 grid gap-2">
        {props.items.length ? (
          props.items.map(item => (
            <div key={item.id} className="rounded-xl border border-border/70 bg-background px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{item.name}</span>
                {item.badge}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              {item.note ? <p className="mt-1 text-xs text-rose-600">{item.note}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{props.emptyText}</p>
        )}
      </div>
    </div>
  );
}
