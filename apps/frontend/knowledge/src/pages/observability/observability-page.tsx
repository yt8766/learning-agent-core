import { useEffect } from 'react';
import { Card, Space, Spin, Statistic, Table, Tag, Timeline, Typography, type TableProps } from 'antd';

import { useKnowledgeObservability } from '../../hooks/use-knowledge-observability';
import type { RagTrace } from '../../types/api';
import { CardGrid, PageSection } from '../shared/ui';

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

  useEffect(() => {
    const traceId = new URLSearchParams(globalThis.location?.search ?? '').get('traceId');
    if (traceId) {
      void selectTrace(traceId);
    }
  }, [selectTrace]);

  return (
    <PageSection subTitle="追踪 RAG 检索、生成和引用链路" title="观测中心">
      {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
      {loading ? <Spin /> : null}
      {!loading ? (
        <>
          <CardGrid>
            <Card>
              <Statistic title="Trace 数" value={metrics?.traceCount ?? traces.length} />
            </Card>
            <Card>
              <Statistic
                suffix="ms"
                title="平均延迟"
                value={metrics?.averageLatencyMs ?? selectedTrace?.latencyMs ?? 0}
              />
            </Card>
            <Card>
              <Statistic title="命中数" value={selectedTrace?.hitCount ?? 0} />
            </Card>
            <Card>
              <Statistic title="引用数" value={selectedTrace?.citationCount ?? 0} />
            </Card>
          </CardGrid>
          <Card title={selectedTrace?.question ?? 'Trace 详情'}>
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
    </PageSection>
  );
}

function readTraceId(trace: RagTrace): string {
  return (trace as RagTrace & { traceId?: string }).traceId ?? trace.id;
}

function readTraceOperation(trace: RagTrace): string {
  return (trace as RagTrace & { operation?: string }).operation ?? '-';
}
