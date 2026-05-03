import { useState, type ReactNode } from 'react';
import {
  AppstoreOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  HomeOutlined,
  LeftOutlined,
  LogoutOutlined,
  MessageOutlined,
  MonitorOutlined,
  RightOutlined,
  SettingOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Space, Typography, type MenuProps } from 'antd';

export type KnowledgeView =
  | 'overview'
  | 'knowledgeBases'
  | 'documents'
  | 'chatLab'
  | 'observability'
  | 'evals'
  | 'settings'
  | 'accountSettings';

const viewByMenuKey: Record<string, KnowledgeView> = {
  chatLab: 'chatLab',
  documents: 'documents',
  evals: 'evals',
  knowledgeBases: 'knowledgeBases',
  observability: 'observability',
  overview: 'overview',
  settings: 'settings',
  accountSettings: 'accountSettings'
};

const navItems: MenuProps['items'] = [
  { icon: <HomeOutlined />, key: 'overview', label: '总览' },
  { icon: <DatabaseOutlined />, key: 'knowledgeBases', label: '知识库' },
  { icon: <FileTextOutlined />, key: 'documents', label: '文档' },
  { icon: <MessageOutlined />, key: 'chatLab', label: '对话实验室' },
  { icon: <MonitorOutlined />, key: 'observability', label: '观测中心' },
  { icon: <ExperimentOutlined />, key: 'evals', label: '评测中心' },
  { icon: <SettingOutlined />, key: 'settings', label: '设置' }
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
          Knowledge 知识库控制台 总览 知识库 文档 对话实验室 观测中心 评测中心 设置 个人设置 退出登录
        </span>
        <div className="knowledge-pro-brand-inline">
          <span aria-hidden="true" className="knowledge-pro-brand-mark">
            <AppstoreOutlined />
          </span>
          <Typography.Text strong>Knowledge 知识库控制台</Typography.Text>
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
            theme="light"
          />
        </Layout.Sider>
        <Layout.Content className="knowledge-pro-content">{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
