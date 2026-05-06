import { useState, type ReactNode } from 'react';
import {
  AppstoreOutlined,
  ApiOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  HddOutlined,
  HomeOutlined,
  KeyOutlined,
  LeftOutlined,
  LogoutOutlined,
  MessageOutlined,
  MonitorOutlined,
  RightOutlined,
  SettingOutlined,
  SafetyOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Space, Typography, type MenuProps } from 'antd';

export type KnowledgeView =
  | 'overview'
  | 'knowledgeBases'
  | 'documents'
  | 'agentFlow'
  | 'chatLab'
  | 'observability'
  | 'evals'
  | 'settings'
  | 'settingsModels'
  | 'settingsKeys'
  | 'settingsStorage'
  | 'settingsSecurity'
  | 'users'
  | 'accountSettings';

const viewByMenuKey: Record<string, KnowledgeView> = {
  agentFlow: 'agentFlow',
  chatLab: 'chatLab',
  documents: 'documents',
  evals: 'evals',
  knowledgeBases: 'knowledgeBases',
  observability: 'observability',
  overview: 'overview',
  settings: 'settings',
  settingsModels: 'settingsModels',
  settingsKeys: 'settingsKeys',
  settingsStorage: 'settingsStorage',
  settingsSecurity: 'settingsSecurity',
  users: 'users',
  accountSettings: 'accountSettings'
};

const navItems: MenuProps['items'] = [
  { icon: <HomeOutlined />, key: 'overview', label: 'RAG 总览' },
  { icon: <DatabaseOutlined />, key: 'knowledgeBases', label: '知识空间' },
  { icon: <FileTextOutlined />, key: 'documents', label: '摄取管线' },
  { icon: <DeploymentUnitOutlined />, key: 'agentFlow', label: 'Agent Flow' },
  { icon: <MessageOutlined />, key: 'chatLab', label: '检索实验室' },
  { icon: <MonitorOutlined />, key: 'observability', label: 'Trace 观测' },
  { icon: <ExperimentOutlined />, key: 'evals', label: '评测回归' },
  { icon: <UserOutlined />, key: 'users', label: '访问治理' },
  {
    icon: <SettingOutlined />,
    key: 'settings',
    label: '系统策略',
    children: [
      { icon: <ApiOutlined />, key: 'settingsModels', label: '模型配置' },
      { icon: <KeyOutlined />, key: 'settingsKeys', label: 'API 密钥' },
      { icon: <HddOutlined />, key: 'settingsStorage', label: '存储管理' },
      { icon: <SafetyOutlined />, key: 'settingsSecurity', label: '安全策略' }
    ]
  }
];

export function AppShell({
  activeView,
  children,
  displayName,
  avatar,
  onLogout,
  onUserNavigate,
  onNavigate
}: {
  activeView?: KnowledgeView;
  avatar: string;
  children: ReactNode;
  displayName: string;
  onLogout: () => void;
  onUserNavigate: (view: KnowledgeView) => void;
  onNavigate: (view: KnowledgeView) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const collapseLabel = collapsed ? '展开左侧栏' : '收起左侧栏';

  return (
    <Layout className={`knowledge-pro-shell ${collapsed ? 'is-collapsed' : 'is-expanded'}`}>
      <Layout.Header className="knowledge-pro-topbar">
        <span className="knowledge-pro-sr-only">
          RAG Ops 控制台 RAG 总览 知识空间 摄取管线 Agent Flow 检索实验室 Trace 观测 评测回归 访问治理 系统策略 模型配置
          API 密钥 存储管理 安全策略 个人设置 退出登录
        </span>
        <div className="knowledge-pro-brand-inline">
          <span aria-hidden="true" className="knowledge-pro-brand-mark">
            <AppstoreOutlined />
          </span>
          <Space className="knowledge-pro-brand-copy" orientation="vertical" size={0}>
            <Typography.Text strong>RAG Ops 控制台</Typography.Text>
            <Typography.Text type="secondary">Knowledge lifecycle command center</Typography.Text>
          </Space>
        </div>
        <Space className="knowledge-pro-topbar-actions">
          <Dropdown
            menu={{
              items: [
                { icon: <SettingOutlined />, key: 'accountSettings', label: '个人设置' },
                { type: 'divider' },
                { icon: <LogoutOutlined />, key: 'logout', label: '退出登录' }
              ],
              onClick: ({ key }) => {
                if (key === 'logout') {
                  onLogout();
                  return;
                }
                if (key === 'accountSettings') {
                  onUserNavigate('accountSettings');
                }
              }
            }}
            placement="bottomRight"
            trigger={['hover']}
          >
            <Button className="knowledge-pro-user" type="text">
              <Avatar className="knowledge-pro-user-avatar" icon={<UserOutlined />} size={28} src={avatar} />
              <Typography.Text className="knowledge-pro-user-name">{displayName}</Typography.Text>
            </Button>
          </Dropdown>
        </Space>
      </Layout.Header>
      <Layout className="knowledge-pro-workspace">
        <Layout.Sider
          className="knowledge-pro-sider"
          collapsed={collapsed}
          collapsedWidth={72}
          theme="light"
          trigger={null}
          width={256}
        >
          <Button
            aria-label={collapseLabel}
            className="knowledge-pro-collapse"
            icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
            onClick={() => setCollapsed(nextCollapsed => !nextCollapsed)}
            shape="circle"
            style={{ minWidth: 24 }}
          />
          <Menu
            className="knowledge-pro-menu"
            inlineCollapsed={collapsed}
            items={navItems}
            mode="inline"
            onClick={({ key }) => {
              const nextView = viewByMenuKey[key];
              if (nextView) {
                onNavigate(nextView);
              }
            }}
            selectedKeys={activeView ? [activeView] : []}
            defaultOpenKeys={activeView?.startsWith('settings') ? ['settings'] : undefined}
            theme="light"
          />
        </Layout.Sider>
        <Layout.Content className="knowledge-pro-content">{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
