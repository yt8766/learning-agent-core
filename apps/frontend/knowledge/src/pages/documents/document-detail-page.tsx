import {
  Alert,
  Button,
  Card,
  Descriptions,
  Progress,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  type TableProps
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';

import { useDocumentDetail } from '../../hooks/use-document-detail';
import type { DocumentChunk } from '../../types/api';
import { MetricStrip, RagOpsPage, type RagOpsMetric } from '../shared/ui';

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
  const metrics: RagOpsMetric[] = [
    { key: 'chunks', label: 'Chunks', status: 'muted', value: document?.chunkCount ?? 0 },
    { key: 'embedded', label: '已向量化', status: 'healthy', value: document?.embeddedChunkCount ?? 0 },
    {
      key: 'progress',
      label: '处理进度',
      status: document?.status === 'failed' ? 'critical' : document?.status === 'ready' ? 'healthy' : 'running',
      suffix: '%',
      value: detail.job?.progress?.percent ?? (document?.status === 'ready' ? 100 : 0)
    }
  ];

  return (
    <RagOpsPage
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
      eyebrow="Document Pipeline Detail"
      subTitle="查看单篇文档的解析、切片、embedding、索引结果和失败恢复路径。"
      title={document?.title ?? '文档详情'}
    >
      <MetricStrip metrics={metrics} />
      {detail.error ? <Typography.Text type="danger">{detail.error.message}</Typography.Text> : null}
      <Card className="rag-ops-panel" loading={detail.loading} title="文档元数据">
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
      <Card className="rag-ops-panel" title="最新处理 Job">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Space>
            <Tag>{detail.job?.status ?? '-'}</Tag>
            {detail.job?.stage ? <Tag>{detail.job.stage}</Tag> : null}
            <Typography.Text>{detail.job?.id ?? '-'}</Typography.Text>
          </Space>
          {detail.job?.progress ? <Progress percent={detail.job.progress.percent} /> : null}
          {detail.job?.error ? (
            <Alert
              action={
                detail.job.error.retryable ? (
                  <Button onClick={() => void detail.reprocess()} size="small">
                    重试
                  </Button>
                ) : undefined
              }
              message={detail.job.error.message}
              showIcon
              type="error"
            />
          ) : null}
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
      <Card className="rag-ops-table-card" title={`Chunks (${detail.totalChunks})`}>
        <Table<DocumentChunk>
          columns={chunkColumns}
          dataSource={detail.chunks}
          loading={detail.loading}
          pagination={false}
          rowKey="id"
        />
      </Card>
    </RagOpsPage>
  );
}

function readObjectKey(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.objectKey;
  return typeof value === 'string' ? value : undefined;
}
