import { MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, Input, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { useWorkspaceUsers } from '../../hooks/use-knowledge-governance';
import type { WorkspaceUser } from '../../types/api';
import { MetricStrip, RagOpsPage, type RagOpsMetric } from '../shared/ui';

const roleLabel: Record<WorkspaceUser['role'], string> = {
  admin: '管理员',
  editor: '编辑者',
  viewer: '浏览者'
};

const statusColor: Record<WorkspaceUser['status'], string> = {
  active: 'success',
  inactive: 'error',
  pending: 'warning'
};

const statusLabel: Record<WorkspaceUser['status'], string> = {
  active: '活跃',
  inactive: '停用',
  pending: '待激活'
};

const columns: ColumnsType<WorkspaceUser> = [
  {
    title: '用户',
    dataIndex: 'name',
    render: (_, row) => (
      <Space>
        <Avatar src={row.avatarUrl}>{row.name.slice(0, 1)}</Avatar>
        <Space orientation="vertical" size={0}>
          <strong>{row.name}</strong>
          <span>{row.email}</span>
        </Space>
      </Space>
    )
  },
  {
    title: '角色',
    dataIndex: 'role',
    render: (value: WorkspaceUser['role']) => (
      <Tag color={value === 'admin' ? 'gold' : value === 'editor' ? 'blue' : 'default'}>{roleLabel[value]}</Tag>
    )
  },
  { title: '部门', dataIndex: 'department' },
  {
    title: '状态',
    dataIndex: 'status',
    render: (value: WorkspaceUser['status']) => <Tag color={statusColor[value]}>{statusLabel[value]}</Tag>
  },
  {
    title: '知识库权限',
    dataIndex: 'kbAccessCount',
    render: value => `${value} 个`
  },
  {
    title: '查询',
    dataIndex: 'queryCount',
    render: value => Number(value).toLocaleString()
  },
  {
    title: '最后活跃',
    dataIndex: 'lastActiveAt',
    render: value => formatTime(value as WorkspaceUser['lastActiveAt'])
  },
  {
    title: '',
    key: 'actions',
    render: () => <Button icon={<MoreOutlined />} type="text" />
  }
];

export function UsersPage() {
  const { data, loading, users } = useWorkspaceUsers();
  const summary = data?.summary ?? {
    activeUsers: users.filter(user => user.status === 'active').length,
    adminUsers: users.filter(user => user.role === 'admin').length,
    pendingUsers: users.filter(user => user.status === 'pending').length,
    totalUsers: users.length
  };
  const metrics: RagOpsMetric[] = [
    { key: 'total', label: '总用户数', status: 'muted', value: summary.totalUsers },
    { key: 'active', label: '活跃用户', status: 'healthy', value: summary.activeUsers },
    { key: 'admins', label: '管理员', status: 'warning', value: summary.adminUsers },
    { key: 'pending', label: '待激活', status: summary.pendingUsers ? 'warning' : 'muted', value: summary.pendingUsers }
  ];

  return (
    <RagOpsPage
      extra={
        <Button icon={<PlusOutlined />} type="primary">
          邀请用户
        </Button>
      }
      eyebrow="Access Governance"
      subTitle="管理成员、角色、知识空间访问范围和查询行为审计。"
      title="访问治理"
    >
      <MetricStrip metrics={metrics} />
      <Card className="rag-ops-table-card" title="成员与知识空间权限">
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Input allowClear prefix={<SearchOutlined />} placeholder="搜索用户..." style={{ maxWidth: 320 }} />
          <Table columns={columns} dataSource={users} loading={loading} pagination={false} rowKey="id" size="middle" />
        </Space>
      </Card>
    </RagOpsPage>
  );
}

function formatTime(value: string | null): string {
  if (!value) {
    return '待激活';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit'
  }).format(new Date(value));
}
