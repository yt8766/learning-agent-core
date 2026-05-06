import { Card, Col, Descriptions, Row, Space, Table, Tag, Typography, type TableProps } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { useKnowledgeBaseDetail } from '../../hooks/use-knowledge-base-detail';
import type { KnowledgeDocument } from '../../types/api';
import { DocumentUploadPanel } from '../documents/document-upload-panel';
import { LifecycleRail, MetricStrip, RagOpsPage, type LifecycleStep, type RagOpsMetric } from '../shared/ui';

const documentColumns: TableProps<KnowledgeDocument>['columns'] = [
  {
    dataIndex: 'title',
    render: (title, record) => (
      <Space orientation="vertical" size={0}>
        <strong>{title}</strong>
        <Typography.Text type="secondary">{record.filename ?? '-'}</Typography.Text>
      </Space>
    ),
    title: '文档'
  },
  { dataIndex: 'sourceType', title: '来源' },
  {
    dataIndex: 'status',
    render: status => (
      <Tag color={status === 'ready' ? 'success' : status === 'failed' ? 'error' : 'processing'}>{status}</Tag>
    ),
    title: '状态'
  },
  { dataIndex: 'chunkCount', title: 'Chunks' },
  { dataIndex: 'embeddedChunkCount', title: '已向量化' },
  {
    dataIndex: 'latestError',
    render: error => error?.message ?? '-',
    title: '错误'
  },
  {
    dataIndex: 'latestError',
    render: (_, record) => record.latestError?.stage ?? record.status,
    title: 'Stage'
  }
];

export function KnowledgeBaseDetailPage() {
  const { knowledgeBaseId } = useParams();
  const navigate = useNavigate();
  const detail = useKnowledgeBaseDetail(knowledgeBaseId);
  const knowledgeBase = detail.knowledgeBase;
  const metrics: RagOpsMetric[] = [
    { key: 'docs', label: '文档', status: 'healthy', value: knowledgeBase?.documentCount ?? 0 },
    { key: 'chunks', label: 'Chunks', status: 'muted', value: knowledgeBase?.chunkCount ?? 0 },
    { key: 'ready', label: 'Ready', status: 'healthy', value: knowledgeBase?.readyDocumentCount ?? 0 },
    {
      key: 'failed',
      label: 'Failed',
      status: knowledgeBase?.failedDocumentCount ? 'critical' : 'muted',
      value: knowledgeBase?.failedDocumentCount ?? 0
    }
  ];
  const lifecycle: LifecycleStep[] = [
    {
      description: '上传、同步或外部连接器进入统一来源层。',
      key: 'source',
      metric: knowledgeBase?.visibility ?? '-',
      status: 'healthy',
      title: '来源'
    },
    {
      description: '解析为可治理文本并形成 chunk 边界。',
      key: 'chunk',
      metric: `${knowledgeBase?.chunkCount ?? 0} chunks`,
      status: 'running',
      title: '切片'
    },
    {
      description: 'Embedding 与索引覆盖决定检索召回底座。',
      key: 'index',
      metric: `${knowledgeBase?.readyDocumentCount ?? 0} ready documents`,
      status: knowledgeBase?.failedDocumentCount ? 'warning' : 'healthy',
      title: '索引'
    },
    {
      description: '对话实验、Trace 和评测回归共同校验质量。',
      key: 'quality',
      metric: knowledgeBase?.latestEvalScore ? `${knowledgeBase.latestEvalScore}% eval` : '等待评测',
      status: 'running',
      title: '质量'
    }
  ];

  return (
    <RagOpsPage
      eyebrow="Knowledge Space Detail"
      subTitle="上传、入库、索引、检索测试与质量回归的空间级视图。"
      title={knowledgeBase?.name ?? '知识空间详情'}
    >
      <MetricStrip metrics={metrics} />
      {detail.error ? <Typography.Text type="danger">{detail.error.message}</Typography.Text> : null}
      <Row gutter={[16, 16]}>
        <Col lg={14} xs={24}>
          <Card className="rag-ops-panel" loading={detail.loading} title="空间摘要">
            <Descriptions bordered column={3} size="small">
              <Descriptions.Item label="状态">{knowledgeBase?.status ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="文档">{knowledgeBase?.documentCount ?? 0}</Descriptions.Item>
              <Descriptions.Item label="Chunks">{knowledgeBase?.chunkCount ?? 0}</Descriptions.Item>
              <Descriptions.Item label="Ready">{knowledgeBase?.readyDocumentCount ?? 0}</Descriptions.Item>
              <Descriptions.Item label="Failed">{knowledgeBase?.failedDocumentCount ?? 0}</Descriptions.Item>
              <Descriptions.Item label="可见性">{knowledgeBase?.visibility ?? '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col lg={10} xs={24}>
          <Card className="rag-ops-panel" title="空间生命周期">
            <LifecycleRail steps={lifecycle} />
          </Card>
        </Col>
      </Row>
      {knowledgeBaseId ? <DocumentUploadPanel knowledgeBaseId={knowledgeBaseId} onUploaded={detail.reload} /> : null}
      <Card className="rag-ops-table-card" title="文档列表">
        <Table<KnowledgeDocument>
          columns={documentColumns}
          dataSource={detail.documents}
          loading={detail.loading}
          onRow={record => ({
            onClick: () => navigate(`/documents/${record.id}`)
          })}
          pagination={false}
          rowKey="id"
        />
      </Card>
    </RagOpsPage>
  );
}
