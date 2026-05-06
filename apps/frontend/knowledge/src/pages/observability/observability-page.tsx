import { useEffect } from 'react';
import { Card, Space, Spin, Table, Tag, Timeline, Typography, type TableProps } from 'antd';

import { useKnowledgeObservability } from '../../hooks/use-knowledge-observability';
import type { RagTrace } from '../../types/api';
import { MetricStrip, RagOpsPage, type RagOpsMetric } from '../shared/ui';

const traceColumns: TableProps<RagTrace>['columns'] = [
  { dataIndex: 'question', render: (question, record) => question || readTraceOperation(record), title: '问题' },
  { dataIndex: 'status', title: '状态', width: 96 },
  { dataIndex: 'latencyMs', title: '延迟(ms)', width: 100 },
  { dataIndex: 'hitCount', title: '命中', width: 80 },
  { dataIndex: 'citationCount', title: '引用', width: 80 }
];

export function ObservabilityPage() {
  const { error, loading, metrics, selectTrace, trace, traceError, traceLoading, traces } = useKnowledgeObservability();
  const selectedTrace = trace ?? traces[0];
  const traceMetrics: RagOpsMetric[] = [
    { key: 'traces', label: 'Trace 数', status: 'muted', value: metrics?.traceCount ?? traces.length },
    {
      key: 'latency',
      label: '平均延迟',
      status: 'warning',
      suffix: 'ms',
      value: metrics?.averageLatencyMs ?? selectedTrace?.latencyMs ?? 0
    },
    { key: 'hits', label: '命中 chunks', status: 'running', value: selectedTrace?.hitCount ?? 0 },
    { key: 'citations', label: '引用数', status: 'healthy', value: selectedTrace?.citationCount ?? 0 }
  ];

  useEffect(() => {
    const traceId = new URLSearchParams(globalThis.location?.search ?? '').get('traceId');
    if (traceId) {
      void selectTrace(traceId);
    }
  }, [selectTrace]);

  return (
    <RagOpsPage
      eyebrow="Trace Observability"
      subTitle="追踪 query rewrite、retrieval、rerank、answer 和 citation 的每一步。"
      title="Trace 观测"
    >
      {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
      {loading ? <Spin /> : null}
      {!loading ? (
        <>
          <MetricStrip metrics={traceMetrics} />
          <Card className="rag-ops-table-card" title={selectedTrace?.question ?? 'Trace 详情'}>
            <Table<RagTrace>
              columns={traceColumns}
              dataSource={traces}
              loading={loading}
              onRow={record => ({
                onClick: () => void selectTrace(readTraceId(record))
              })}
              pagination={false}
              rowKey={readTraceId}
              size="small"
            />
            {traceError ? <Typography.Text type="danger">{traceError.message}</Typography.Text> : null}
            {traceLoading ? <Spin /> : null}
            <Typography.Paragraph>{trace?.answer ?? selectedTrace?.answer}</Typography.Paragraph>
            <Timeline
              items={(trace?.spans ?? []).map(span => ({
                children: (
                  <Space>
                    <Typography.Text>{span.name}</Typography.Text>
                    <Tag>{span.status}</Tag>
                  </Space>
                ),
                color: span.status === 'succeeded' || String(span.status) === 'ok' ? 'green' : 'red'
              }))}
            />
          </Card>
        </>
      ) : null}
    </RagOpsPage>
  );
}

function readTraceId(trace: RagTrace): string {
  return (trace as RagTrace & { traceId?: string }).traceId ?? trace.id;
}

function readTraceOperation(trace: RagTrace): string {
  return (trace as RagTrace & { operation?: string }).operation ?? '-';
}
