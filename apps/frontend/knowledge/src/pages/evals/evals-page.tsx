import { Card, Progress, Space, Spin, Table, Tag, Typography, type TableProps } from 'antd';

import { useKnowledgeEvals } from '../../hooks/use-knowledge-evals';
import type { EvalRun } from '../../types/api';
import { CardGrid, MetricStrip, RagOpsPage, type RagOpsMetric } from '../shared/ui';

const columns: TableProps<EvalRun>['columns'] = [
  { dataIndex: 'id', title: '运行 ID' },
  {
    dataIndex: 'status',
    render: status => <Tag color={status === 'succeeded' ? 'success' : 'processing'}>{status}</Tag>,
    title: '状态'
  },
  { dataIndex: 'caseCount', title: '用例' },
  {
    dataIndex: 'summary',
    render: summary => <Progress percent={summary?.totalScore ?? 0} size="small" />,
    title: '总分'
  }
];

export function EvalsPage() {
  const { comparisonText, datasets, error, loading, runs } = useKnowledgeEvals();
  const latestScore = runs[0]?.summary?.totalScore ?? 0;
  const metrics: RagOpsMetric[] = [
    { key: 'datasets', label: 'Datasets', status: 'healthy', value: datasets.length },
    {
      key: 'cases',
      label: 'Cases',
      status: 'muted',
      value: datasets.reduce((total, dataset) => total + dataset.caseCount, 0)
    },
    { key: 'runs', label: 'Runs', status: 'running', value: runs.length },
    {
      key: 'score',
      label: '最新总分',
      status: latestScore >= 80 ? 'healthy' : 'warning',
      suffix: '%',
      value: latestScore
    }
  ];

  return (
    <RagOpsPage
      eyebrow="Evaluation Regression"
      subTitle="用数据集、运行记录和质量指标阻断低质量 RAG 变更。"
      title="评测回归"
    >
      <MetricStrip metrics={metrics} />
      {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
      {loading ? <Spin /> : null}
      <CardGrid>
        {datasets.map(dataset => (
          <Card key={dataset.id} title={dataset.name}>
            <Space orientation="vertical">
              <span>Case {dataset.caseCount}</span>
              <span>
                {dataset.tags.map(tag => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </span>
            </Space>
          </Card>
        ))}
      </CardGrid>
      <Card className="rag-ops-table-card" title="运行记录">
        <Table<EvalRun> columns={columns} dataSource={runs} loading={loading} pagination={false} rowKey="id" />
      </Card>
      <Card className="rag-ops-panel" title="运行对比">
        <Typography.Paragraph>{comparisonText}</Typography.Paragraph>
      </Card>
    </RagOpsPage>
  );
}
