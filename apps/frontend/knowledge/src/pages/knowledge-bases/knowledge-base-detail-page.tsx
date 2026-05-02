import { Card, Descriptions, Space, Table, Tag, Typography, type TableProps } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { useKnowledgeBaseDetail } from '../../hooks/use-knowledge-base-detail';
import type { KnowledgeDocument } from '../../types/api';
import { DocumentUploadPanel } from '../documents/document-upload-panel';
import { PageSection } from '../shared/ui';

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

  return (
    <PageSection subTitle="上传、入库、处理状态与文档明细" title={knowledgeBase?.name ?? '知识库详情'}>
      {detail.error ? <Typography.Text type="danger">{detail.error.message}</Typography.Text> : null}
      <Card loading={detail.loading} title="知识库摘要">
        <Descriptions bordered column={3} size="small">
          <Descriptions.Item label="状态">{knowledgeBase?.status ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="文档">{knowledgeBase?.documentCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Chunks">{knowledgeBase?.chunkCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Ready">{knowledgeBase?.readyDocumentCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Failed">{knowledgeBase?.failedDocumentCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="可见性">{knowledgeBase?.visibility ?? '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
      {knowledgeBaseId ? <DocumentUploadPanel knowledgeBaseId={knowledgeBaseId} onUploaded={detail.reload} /> : null}
      <Card title="文档列表">
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
    </PageSection>
  );
}
