import { useRef } from 'react';
import { Button, Card, Popconfirm, Space, Spin, Table, Tag, Typography, type TableProps } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';

import { useKnowledgeDashboard } from '../../hooks/use-knowledge-dashboard';
import { useKnowledgeDocuments } from '../../hooks/use-knowledge-documents';
import type { KnowledgeBase, KnowledgeDocument } from '../../types/api';
import { PageSection } from '../shared/ui';

function createColumns(
  onReprocess: (documentId: string) => void,
  onDelete: (documentId: string) => void
): TableProps<KnowledgeDocument>['columns'] {
  return [
    {
      dataIndex: 'title',
      render: (title, record) => (
        <Space orientation="vertical" size={0}>
          <strong>{title}</strong>
          <Typography.Text type="secondary">{record.filename}</Typography.Text>
        </Space>
      ),
      title: '文档'
    },
    { dataIndex: 'sourceType', title: '来源' },
    {
      dataIndex: 'status',
      render: status => <Tag color={status === 'ready' ? 'success' : 'processing'}>{status}</Tag>,
      title: '状态'
    },
    { dataIndex: 'chunkCount', title: 'Chunks' },
    { dataIndex: 'embeddedChunkCount', title: '已向量化' },
    {
      dataIndex: 'latestError',
      render: error => error?.message ?? '-',
      title: '错误原因'
    },
    {
      dataIndex: 'latestError',
      render: (_, record) => record.latestError?.stage ?? record.status,
      title: '处理 Stage'
    },
    {
      render: (_, record) => (
        <Space>
          <Typography.Link href={`/documents/${record.id}`}>详情</Typography.Link>
          <Button disabled={record.status !== 'failed'} onClick={() => onReprocess(record.id)} size="small">
            重新处理
          </Button>
          <Popconfirm
            cancelText="取消"
            description={`删除后将移除 ${record.title} 的文档记录与索引数据。`}
            okButtonProps={{ danger: true }}
            okText="确认删除"
            onConfirm={() => onDelete(record.id)}
            title="删除文档？"
          >
            <Button danger icon={<DeleteOutlined />} size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
      title: '操作'
    }
  ];
}

export function DocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { documents, error, loading, reprocessDocument, deleteDocument, uploadDocument } = useKnowledgeDocuments();
  const { error: knowledgeBasesError, knowledgeBases, loading: knowledgeBasesLoading } = useKnowledgeDashboard();
  const uploadKnowledgeBaseId = resolveDocumentUploadKnowledgeBaseId(knowledgeBases);
  const previewDocument = documents[0];
  const columns = createColumns(
    documentId => {
      void reprocessDocument(documentId);
    },
    documentId => {
      void deleteDocument(documentId);
    }
  );

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    if (!uploadKnowledgeBaseId) {
      return;
    }
    void uploadDocument(file, uploadKnowledgeBaseId);
    event.currentTarget.value = '';
  }

  return (
    <PageSection
      extra={
        <>
          <input
            ref={fileInputRef}
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            aria-label="选择上传文档"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            type="file"
          />
          <Button
            disabled={!uploadKnowledgeBaseId}
            icon={<UploadOutlined />}
            loading={knowledgeBasesLoading}
            onClick={() => fileInputRef.current?.click()}
            type="primary"
          >
            上传文档
          </Button>
        </>
      }
      subTitle="文档入库、分块、向量化与检索片段预览"
      title="文档"
    >
      {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
      {knowledgeBasesError ? <Typography.Text type="danger">{knowledgeBasesError.message}</Typography.Text> : null}
      {!knowledgeBasesLoading && !uploadKnowledgeBaseId ? (
        <Typography.Text type="secondary">请先创建或加入一个知识库后再上传文档</Typography.Text>
      ) : null}
      {loading ? <Spin /> : null}
      <Card>
        <Table<KnowledgeDocument>
          columns={columns}
          dataSource={documents}
          loading={loading}
          pagination={false}
          rowKey="id"
        />
      </Card>
      <Card title="命中片段预览">
        <Typography.Paragraph>
          {previewDocument
            ? `${previewDocument.title} · ${previewDocument.status} · ${previewDocument.chunkCount} chunks`
            : '暂无文档片段'}
        </Typography.Paragraph>
      </Card>
    </PageSection>
  );
}

export function resolveDocumentUploadKnowledgeBaseId(knowledgeBases: readonly KnowledgeBase[]): string | undefined {
  return knowledgeBases[0]?.id;
}
