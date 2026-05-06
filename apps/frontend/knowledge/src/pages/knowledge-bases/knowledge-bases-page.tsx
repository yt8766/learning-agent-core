import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  type TableProps
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { useKnowledgeApi } from '../../api/knowledge-api-provider';
import { useKnowledgeDashboard } from '../../hooks/use-knowledge-dashboard';
import type { KnowledgeBase, KnowledgeBaseVisibility } from '../../types/api';
import { MetricStrip, RagOpsPage, type RagOpsMetric } from '../shared/ui';

type KnowledgeBaseHealthFilter = 'all' | NonNullable<KnowledgeBase['health']>['status'];

const healthFilters: KnowledgeBaseHealthFilter[] = ['all', 'ready', 'indexing', 'degraded', 'empty', 'error'];

const columns: TableProps<KnowledgeBase>['columns'] = [
  {
    dataIndex: 'name',
    render: (name, record) => (
      <Space orientation="vertical" size={0}>
        <strong>{name}</strong>
        {record.health?.warnings?.map(warning => (
          <Typography.Text key={warning.code} type="warning">
            {warning.message}
          </Typography.Text>
        ))}
        <span>
          {record.tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </span>
      </Space>
    ),
    title: '知识库'
  },
  {
    dataIndex: 'status',
    render: (status, record) => (
      <Space>
        <Tag color={status === 'active' ? 'success' : 'default'}>{status}</Tag>
        {record.health?.status ? (
          <Tag
            color={
              record.health.status === 'ready' ? 'success' : record.health.status === 'degraded' ? 'warning' : 'default'
            }
          >
            {record.health.status}
          </Tag>
        ) : null}
      </Space>
    ),
    title: '状态'
  },
  { dataIndex: 'documentCount', title: '文档' },
  { dataIndex: 'chunkCount', title: 'Chunks' },
  {
    dataIndex: 'latestEvalScore',
    render: score => <Progress percent={score ?? 0} size="small" />,
    title: '评测分'
  }
];

export function KnowledgeBasesPage() {
  const api = useKnowledgeApi() as ReturnType<typeof useKnowledgeApi> & {
    createKnowledgeBase?: (input: {
      description?: string;
      name: string;
      visibility: KnowledgeBaseVisibility;
    }) => Promise<KnowledgeBase>;
  };
  const navigate = useNavigate();
  const [form] = Form.useForm<{ description?: string; name: string; visibility: KnowledgeBaseVisibility }>();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<Error | null>(null);
  const [healthFilter, setHealthFilter] = useState<KnowledgeBaseHealthFilter>('all');
  const [keyword, setKeyword] = useState('');
  const { error, knowledgeBases, loading, reload } = useKnowledgeDashboard();
  const filteredKnowledgeBases = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return knowledgeBases.filter(record => {
      const matchesKeyword =
        !normalizedKeyword ||
        [record.name, record.description, ...record.tags]
          .filter((value): value is string => Boolean(value))
          .some(value => value.toLowerCase().includes(normalizedKeyword));
      const matchesHealth = healthFilter === 'all' || record.health?.status === healthFilter;
      return matchesKeyword && matchesHealth;
    });
  }, [healthFilter, keyword, knowledgeBases]);
  const metrics = useMemo<RagOpsMetric[]>(
    () => [
      { key: 'total', label: '知识空间', status: 'healthy', value: knowledgeBases.length },
      {
        key: 'ready',
        label: 'Ready 空间',
        status: 'healthy',
        value: knowledgeBases.filter(record => record.health?.status === 'ready').length
      },
      {
        key: 'docs',
        label: '文档总量',
        status: 'muted',
        value: knowledgeBases.reduce((total, record) => total + record.documentCount, 0)
      },
      {
        key: 'chunks',
        label: 'Chunks',
        status: 'muted',
        value: knowledgeBases.reduce((total, record) => total + record.chunkCount, 0)
      }
    ],
    [knowledgeBases]
  );

  async function handleCreateKnowledgeBase() {
    try {
      const values = await form.validateFields();
      if (!api.createKnowledgeBase) {
        throw new Error('知识库创建 API 尚未接入');
      }
      setCreating(true);
      setCreateError(null);
      const created = await api.createKnowledgeBase(values);
      setCreateOpen(false);
      form.resetFields();
      await reload();
      navigate(`/knowledge-bases/${created.id}`);
    } catch (caught) {
      if (caught instanceof Error) {
        setCreateError(caught);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <RagOpsPage
      extra={
        <Space className="knowledge-base-toolbar" wrap>
          <Input.Search
            allowClear
            onChange={event => setKeyword(event.target.value)}
            placeholder="搜索知识库"
            value={keyword}
          />
          <Space.Compact>
            {healthFilters.map(filter => (
              <Button
                key={filter}
                onClick={() => setHealthFilter(filter)}
                type={healthFilter === filter ? 'primary' : 'default'}
              >
                {filter}
              </Button>
            ))}
          </Space.Compact>
          <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} type="primary">
            新建知识库
          </Button>
        </Space>
      }
      eyebrow="Knowledge Spaces"
      subTitle="按空间治理文档覆盖、索引健康、评测分和检索风险。"
      title="知识空间"
    >
      <MetricStrip metrics={metrics} />
      {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
      <Card className="rag-ops-table-card" title="空间资产与健康状态">
        <Table<KnowledgeBase>
          columns={columns}
          dataSource={filteredKnowledgeBases}
          loading={loading}
          onRow={record => ({
            onClick: () => navigate(`/knowledge-bases/${record.id}`)
          })}
          pagination={false}
          rowKey="id"
        />
      </Card>
      <Modal
        confirmLoading={creating}
        okText="创建"
        onCancel={() => setCreateOpen(false)}
        onOk={() => {
          void handleCreateKnowledgeBase();
        }}
        open={createOpen}
        title="新建知识库"
      >
        <Form form={form} layout="vertical" initialValues={{ visibility: 'workspace' }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入知识库名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="可见性" name="visibility" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '私有', value: 'private' },
                { label: '工作区', value: 'workspace' },
                { label: '公开', value: 'public' }
              ]}
            />
          </Form.Item>
        </Form>
        {createError ? <Typography.Text type="danger">{createError.message}</Typography.Text> : null}
      </Modal>
    </RagOpsPage>
  );
}
