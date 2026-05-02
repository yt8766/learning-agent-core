import { Button, Card, Descriptions, Space, Table, Tag, Timeline, Typography, type TableProps } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';

import { useDocumentDetail } from '../../hooks/use-document-detail';
import type { DocumentChunk } from '../../types/api';
import { PageSection } from '../shared/ui';

const chunkColumns: TableProps<DocumentChunk>['columns'] = [
  { dataIndex: 'chunkIndex', title: '#' },
  {
    dataIndex: 'content',
    render: content => <Typography.Paragraph ellipsis={{ rows: 2 }}>{content}</Typography.Paragraph>,
    title: '内容'
  },
  { dataIndex: 'tokenCount', title: 'Tokens' },
  {
    dataIndex: 'embeddingStatus',
    render: status => <Tag color={status === 'ready' ? 'success' : 'default'}>{status ?? 'missing'}</Tag>,
    title: 'Embedding'
  },
  { dataIndex: 'embeddingModel', title: '模型' },
  {
    dataIndex: 'status',
    render: status => <Tag color={status === 'ready' ? 'success' : 'default'}>{status}</Tag>,
    title: '状态'
  }
];

export function DocumentDetailPage() {
  const { documentId } = useParams();
  const detail = useDocumentDetail(documentId);
  const document = detail.document;
  const objectKey = readObjectKey(document?.metadata);

  return (
    <PageSection
      extra={
        <Button
          disabled={!detail.reprocessAvailable || detail.loading}
          icon={<ReloadOutlined />}
          onClick={() => {
            void detail.reprocess();
          }}
        >
          重新处理
        </Button>
      }
      subTitle="文档处理状态、分块与索引结果"
      title={document?.title ?? '文档详情'}
    >
      {detail.error ? <Typography.Text type="danger">{detail.error.message}</Typography.Text> : null}
      <Card loading={detail.loading} title="文档元数据">
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="文档 ID">{document?.id ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="文件名">{document?.filename ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">{document?.status ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="来源">{document?.sourceType ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Chunks">{document?.chunkCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="已向量化">{document?.embeddedChunkCount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Object Key" span={2}>
            {objectKey ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="最新处理 Job">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Space>
            <Tag>{detail.job?.status ?? '-'}</Tag>
            <Typography.Text>{detail.job?.id ?? '-'}</Typography.Text>
          </Space>
          <Timeline
            items={(detail.job?.stages ?? []).map(stage => ({
              children: (
                <Space>
                  <Typography.Text>{stage.stage}</Typography.Text>
                  <Tag>{stage.status}</Tag>
                  {stage.error ? <Typography.Text type="danger">{stage.error.message}</Typography.Text> : null}
                </Space>
              )
            }))}
          />
        </Space>
      </Card>
      <Card title={`Chunks (${detail.totalChunks})`}>
        <Table<DocumentChunk>
          columns={chunkColumns}
          dataSource={detail.chunks}
          loading={detail.loading}
          pagination={false}
          rowKey="id"
        />
      </Card>
    </PageSection>
  );
}

function readObjectKey(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.objectKey;
  return typeof value === 'string' ? value : undefined;
}
