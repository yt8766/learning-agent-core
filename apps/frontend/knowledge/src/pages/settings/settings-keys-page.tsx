import { EyeInvisibleOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { useSettingsApiKeys } from '../../hooks/use-knowledge-governance';
import type { SettingsApiKey } from '../../types/api';
import { RagOpsPage } from '../shared/ui';

const permissionLabel: Record<SettingsApiKey['permissions'][number], string> = {
  'knowledge:read': '读',
  'knowledge:write': '写',
  'settings:manage': '设置',
  'users:manage': '用户'
};

const columns: ColumnsType<SettingsApiKey> = [
  {
    title: '名称',
    dataIndex: 'name',
    render: value => (
      <Space>
        <KeyOutlined />
        <Typography.Text strong>{value}</Typography.Text>
      </Space>
    )
  },
  {
    title: '密钥',
    dataIndex: 'maskedKey',
    render: value => (
      <Typography.Text code>
        <EyeInvisibleOutlined /> {value}
      </Typography.Text>
    )
  },
  {
    title: '权限',
    dataIndex: 'permissions',
    render: permissions =>
      permissions.map((permission: SettingsApiKey['permissions'][number]) => (
        <Tag key={permission}>{permissionLabel[permission]}</Tag>
      ))
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    render: value => formatTime(value as string)
  },
  {
    title: '最后使用',
    dataIndex: 'lastUsedAt',
    render: value => (value ? formatTime(value as string) : '从未使用')
  },
  {
    title: '状态',
    dataIndex: 'status',
    render: value => (
      <Tag color={value === 'active' ? 'success' : 'error'}>{value === 'active' ? '生效中' : '已撤销'}</Tag>
    )
  }
];

export function SettingsKeysPage() {
  const { apiKeys, loading } = useSettingsApiKeys();

  return (
    <RagOpsPage
      extra={
        <Button icon={<PlusOutlined />} type="primary">
          新建密钥
        </Button>
      }
      eyebrow="Credentials"
      subTitle="管理外部调用知识库服务的访问密钥、权限范围和轮换状态。"
      title="API 密钥"
    >
      <Alert title="API 密钥拥有账号授权范围内的知识库访问能力，请定期轮换并限制权限范围。" showIcon type="warning" />
      <Card className="rag-ops-table-card">
        <Table columns={columns} dataSource={apiKeys} loading={loading} pagination={false} rowKey="id" />
      </Card>
    </RagOpsPage>
  );
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit'
  }).format(new Date(value));
}
