import { Card, Progress, Space, Spin, Table, Tag, Typography, type TableProps } from 'antd';

import { useKnowledgeEvals } from '../../hooks/use-knowledge-evals';
import type { EvalRun } from '../../types/api';
import { CardGrid, PageSection } from '../shared/ui';

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

  return (
    <PageSection subTitle="评测集、运行记录和质量分跟踪" title="评测中心">
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
      <Card title="运行记录">
        <Table<EvalRun> columns={columns} dataSource={runs} loading={loading} pagination={false} rowKey="id" />
      </Card>
      <Card title="运行对比">
        <Typography.Paragraph>{comparisonText}</Typography.Paragraph>
      </Card>
    </PageSection>
  );
}
