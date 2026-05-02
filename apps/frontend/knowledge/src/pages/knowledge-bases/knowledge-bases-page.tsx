import { useState } from 'react';
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
import { PageSection } from '../shared/ui';

const columns: TableProps<KnowledgeBase>['columns'] = [
  {
    dataIndex: 'name',
    render: (name, record) => (
      <Space orientation="vertical" size={0}>
        <strong>{name}</strong>
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
    render: status => <Tag color={status === 'active' ? 'success' : 'default'}>{status}</Tag>,
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
  const { error, knowledgeBases, loading, reload } = useKnowledgeDashboard();

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
    <PageSection
      extra={
        <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} type="primary">
          新建知识库
        </Button>
      }
      subTitle="按工作区治理知识库状态、质量分和检索规模"
      title="知识库"
    >
      {error ? <Typography.Text type="danger">{error.message}</Typography.Text> : null}
      <Card>
        <Table<KnowledgeBase>
          columns={columns}
          dataSource={knowledgeBases}
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
    </PageSection>
  );
}
