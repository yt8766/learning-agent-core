import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
  type TableProps
} from 'antd';
import { DeleteOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';

import { useKnowledgeApi } from '../../api/knowledge-api-provider';
import { useKnowledgeDashboard } from '../../hooks/use-knowledge-dashboard';
import { useKnowledgeDocuments } from '../../hooks/use-knowledge-documents';
import { useDocumentUpload } from '../../hooks/use-document-upload';
import type { EmbeddingModelOption, KnowledgeBase, KnowledgeDocument } from '../../types/api';
import { LifecycleRail, MetricStrip, RagOpsPage, type LifecycleStep, type RagOpsMetric } from '../shared/ui';

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
    {
      render: (_, record) => (
        <Progress
          percent={resolveDocumentProgressPercent(record)}
          size="small"
          status={record.status === 'failed' ? 'exception' : record.status === 'ready' ? 'success' : 'active'}
        />
      ),
      title: '进度'
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
  const api = useKnowledgeApi();
  const { documents, error, loading, reprocessDocument, deleteDocument, reload } = useKnowledgeDocuments();
  const { error: knowledgeBasesError, knowledgeBases, loading: knowledgeBasesLoading } = useKnowledgeDashboard();
  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingModelOption[]>([]);
  const [embeddingModelsError, setEmbeddingModelsError] = useState<Error | null>(null);
  const [embeddingModelsLoading, setEmbeddingModelsLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedEmbeddingModelId, setSelectedEmbeddingModelId] = useState<string>();
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>();
  const upload = useDocumentUpload({
    embeddingModelId: selectedEmbeddingModelId,
    knowledgeBaseId: selectedKnowledgeBaseId ?? ''
  });
  const uploadBusy = upload.status === 'uploading' || upload.status === 'creating' || upload.status === 'polling';
  const previewDocument = documents[0];
  const documentMetrics = useMemo<RagOpsMetric[]>(
    () => [
      { key: 'total', label: '文档', status: 'muted', value: documents.length },
      {
        key: 'ready',
        label: 'Ready',
        status: 'healthy',
        value: documents.filter(item => item.status === 'ready').length
      },
      {
        key: 'running',
        label: '处理中',
        status: 'running',
        value: documents.filter(item => item.status !== 'ready' && item.status !== 'failed').length
      },
      {
        key: 'failed',
        label: 'Failed',
        status: documents.some(item => item.status === 'failed') ? 'critical' : 'muted',
        value: documents.filter(item => item.status === 'failed').length
      }
    ],
    [documents]
  );
  const pipelineSteps = useMemo<LifecycleStep[]>(
    () => [
      {
        description: '接收 Markdown/TXT 上传并绑定目标知识空间。',
        key: 'upload',
        metric: selectedKnowledgeBaseId ? '目标空间已选择' : '等待选择知识空间',
        status: selectedKnowledgeBaseId ? 'healthy' : 'warning',
        title: '上传'
      },
      {
        description: '解析正文、抽取元数据并落入可审查的清洗结果。',
        key: 'parse',
        metric: `${documents.filter(item => item.status !== 'failed').length} 篇可处理`,
        status: 'running',
        title: '解析'
      },
      {
        description: '生成稳定 chunk 边界，避免低质量片段进入检索上下文。',
        key: 'chunk',
        metric: `${documents.reduce((total, item) => total + item.chunkCount, 0)} chunks`,
        status: 'running',
        title: '切片'
      },
      {
        description: 'Embedding、关键词索引与向量索引完成后才进入可检索状态。',
        key: 'index',
        metric: `${documents.reduce((total, item) => total + item.embeddedChunkCount, 0)} 已向量化`,
        status: documents.some(item => item.status === 'failed') ? 'warning' : 'healthy',
        title: '索引'
      }
    ],
    [documents, selectedKnowledgeBaseId]
  );
  const knowledgeBaseOptions = useMemo(
    () => knowledgeBases.map(item => ({ label: item.name, value: item.id })),
    [knowledgeBases]
  );
  const embeddingModelOptions = useMemo(
    () => embeddingModels.map(item => ({ label: `${item.name} · ${item.provider}`, value: item.id })),
    [embeddingModels]
  );
  const columns = createColumns(
    documentId => {
      void reprocessDocument(documentId);
    },
    documentId => {
      void deleteDocument(documentId);
    }
  );

  useEffect(() => {
    if (knowledgeBases.length === 1 && !selectedKnowledgeBaseId) {
      setSelectedKnowledgeBaseId(knowledgeBases[0]?.id);
      return;
    }
    if (selectedKnowledgeBaseId && !knowledgeBases.some(item => item.id === selectedKnowledgeBaseId)) {
      setSelectedKnowledgeBaseId(undefined);
    }
  }, [knowledgeBases, selectedKnowledgeBaseId]);

  useEffect(() => {
    let mounted = true;
    setEmbeddingModelsLoading(true);
    setEmbeddingModelsError(null);
    void api
      .listEmbeddingModels()
      .then(result => {
        if (!mounted) {
          return;
        }
        setEmbeddingModels(result.items);
        setSelectedEmbeddingModelId(current => current ?? result.items[0]?.id);
      })
      .catch(error => {
        if (mounted) {
          setEmbeddingModelsError(toError(error));
        }
      })
      .finally(() => {
        if (mounted) {
          setEmbeddingModelsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [api]);

  function handleUploadFile(file: File) {
    if (!file) {
      return;
    }
    if (!selectedKnowledgeBaseId || !selectedEmbeddingModelId) {
      return;
    }
    void upload.upload(file).then(uploaded => {
      if (uploaded) {
        setUploadModalOpen(false);
        void reload();
      }
    });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
    event.currentTarget.value = '';
  }

  return (
    <RagOpsPage
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
            icon={<UploadOutlined />}
            loading={knowledgeBasesLoading || embeddingModelsLoading || uploadBusy}
            onClick={() => setUploadModalOpen(true)}
            type="primary"
          >
            上传文档
          </Button>
        </>
      }
      eyebrow="Ingestion Pipeline"
      subTitle="管理文档上传、解析、切片、embedding、索引与失败恢复。"
      title="摄取管线"
    >
      <MetricStrip metrics={documentMetrics} />
      <Card className="rag-ops-panel" title="摄取生命周期">
        <LifecycleRail steps={pipelineSteps} />
      </Card>
      {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
      {knowledgeBasesError ? <Typography.Text type="danger">{knowledgeBasesError.message}</Typography.Text> : null}
      {embeddingModelsError ? <Typography.Text type="danger">{embeddingModelsError.message}</Typography.Text> : null}
      {!knowledgeBasesLoading && !selectedKnowledgeBaseId ? (
        <Typography.Text type="secondary">请先创建或加入一个知识库后再上传文档</Typography.Text>
      ) : null}
      {upload.error ? <Typography.Text type="danger">{upload.error.message}</Typography.Text> : null}
      <Modal footer={null} onCancel={() => setUploadModalOpen(false)} open={uploadModalOpen} title="上传文档">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Select
            aria-label="选择目标知识库"
            disabled={knowledgeBasesLoading}
            loading={knowledgeBasesLoading}
            onChange={setSelectedKnowledgeBaseId}
            options={knowledgeBaseOptions}
            placeholder="选择目标知识库"
            style={{ width: '100%' }}
            value={selectedKnowledgeBaseId}
          />
          <Select
            aria-label="选择 Embedding Model"
            disabled={embeddingModelsLoading}
            loading={embeddingModelsLoading}
            onChange={setSelectedEmbeddingModelId}
            options={embeddingModelOptions}
            placeholder="选择 Embedding Model"
            style={{ width: '100%' }}
            value={selectedEmbeddingModelId}
          />
          <Upload.Dragger
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            beforeUpload={file => {
              handleUploadFile(file);
              return false;
            }}
            className="knowledge-document-upload-dragger"
            disabled={!selectedKnowledgeBaseId || !selectedEmbeddingModelId || uploadBusy}
            maxCount={1}
            multiple={false}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">拖拽 Markdown/TXT 到此处</p>
            <p className="ant-upload-hint">文件会先上传到后端，再创建文档入库任务。</p>
          </Upload.Dragger>
          <Button
            disabled={!selectedKnowledgeBaseId || !selectedEmbeddingModelId}
            icon={<UploadOutlined />}
            loading={uploadBusy}
            onClick={() => fileInputRef.current?.click()}
            type="primary"
          >
            选择 Markdown/TXT
          </Button>
          <Space align="center" style={{ width: '100%' }}>
            <Typography.Text type="secondary">上传进度</Typography.Text>
            <Progress
              percent={upload.progressPercent}
              size="small"
              status={upload.status === 'failed' ? 'exception' : 'active'}
              style={{ minWidth: 240 }}
            />
            <Tag>{upload.status}</Tag>
          </Space>
        </Space>
      </Modal>
      {loading ? <Spin /> : null}
      <Card className="rag-ops-table-card" title="处理队列">
        <Table<KnowledgeDocument>
          columns={columns}
          dataSource={documents}
          loading={loading}
          pagination={false}
          rowKey="id"
        />
      </Card>
      <Card className="rag-ops-panel" title="命中片段预览">
        <Typography.Paragraph>
          {previewDocument
            ? `${previewDocument.title} · ${previewDocument.status} · ${previewDocument.chunkCount} chunks`
            : '暂无文档片段'}
        </Typography.Paragraph>
      </Card>
    </RagOpsPage>
  );
}

export function resolveDocumentUploadKnowledgeBaseId(knowledgeBases: readonly KnowledgeBase[]): string | undefined {
  return knowledgeBases.length === 1 ? knowledgeBases[0]?.id : undefined;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function resolveDocumentProgressPercent(document: KnowledgeDocument): number {
  if (document.status === 'ready') {
    return 100;
  }
  if (document.status === 'failed' || document.status === 'disabled' || document.status === 'deprecated') {
    return 100;
  }
  if (document.chunkCount > 0) {
    return Math.max(1, Math.min(99, Math.round((document.embeddedChunkCount / document.chunkCount) * 100)));
  }
  const stageProgress: Record<string, number> = {
    uploaded: 10,
    queued: 15,
    parsing: 30,
    cleaning: 40,
    chunking: 55,
    embedding: 75,
    indexing: 90
  };
  return stageProgress[document.status] ?? 0;
}
