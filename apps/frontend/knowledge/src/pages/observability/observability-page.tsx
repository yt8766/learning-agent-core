import { useEffect } from 'react';
import { Card, Spin, Statistic, Table, Timeline, Typography, type TableProps } from 'antd';

import { useKnowledgeObservability } from '../../hooks/use-knowledge-observability';
import type { RagTrace } from '../../types/api';
import { CardGrid, PageSection } from '../shared/ui';

const traceColumns: TableProps<RagTrace>['columns'] = [
  { dataIndex: 'question', title: '问题' },
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
                onClick: () => void selectTrace(record.id)
              })}
              pagination={false}
              rowKey="id"
              size="small"
            />
            {traceError ? <Typography.Text type="danger">{traceError.message}</Typography.Text> : null}
            {traceLoading ? <Spin /> : null}
            <Typography.Paragraph>{trace?.answer ?? selectedTrace?.answer}</Typography.Paragraph>
            <Timeline
              items={(trace?.spans ?? []).map(span => ({
                children: `${span.name} · ${span.latencyMs}ms`,
                color: span.status === 'succeeded' ? 'green' : 'red'
              }))}
            />
          </Card>
        </>
      ) : null}
    </PageSection>
  );
}
