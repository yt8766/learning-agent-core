/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => ({
  Avatar: ({ children, className, icon, size, src }: any) => (
    <span className={className} data-size={size} data-src={src}>
      {icon}
      {children}
    </span>
  ),
  Button: ({ children, className, icon, onClick, shape, style, type }: any) => (
    <button className={className} data-shape={shape} data-type={type} style={style} onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Dropdown: ({ children, menu }: any) => (
    <div className="dropdown" data-menu-items={menu?.items?.length}>
      {children}
    </div>
  ),
  Layout: Object.assign(({ children, className }: any) => <div className={className}>{children}</div>, {
    Content: ({ children, className }: any) => <div className={className}>{children}</div>,
    Header: ({ children, className }: any) => <header className={className}>{children}</header>,
    Sider: ({ children, className, collapsed }: any) => (
      <aside className={className} data-collapsed={collapsed}>
        {children}
      </aside>
    )
  }),
  Menu: ({ items, selectedKeys, onClick, inlineCollapsed, mode, theme, className }: any) => (
    <nav
      className={className}
      data-selected={selectedKeys?.[0]}
      data-collapsed={inlineCollapsed}
      data-mode={mode}
      data-theme={theme}
      data-items={items?.length}
      data-has-click={onClick ? 'true' : 'false'}
    />
  ),
  Space: ({ children, className }: any) => <div className={className}>{children}</div>,
  Typography: {
    Text: ({ children, className, strong, type }: any) => {
      if (strong)
        return (
          <strong className={className} data-type={type}>
            {children}
          </strong>
        );
      return (
        <span className={className} data-type={type}>
          {children}
        </span>
      );
    }
  }
}));

vi.mock('@ant-design/icons', () => ({
  ApiOutlined: () => null,
  AppstoreOutlined: () => null,
  DatabaseOutlined: () => null,
  DeploymentUnitOutlined: () => null,
  ExperimentOutlined: () => null,
  FileTextOutlined: () => null,
  HddOutlined: () => null,
  HomeOutlined: () => null,
  KeyOutlined: () => null,
  LeftOutlined: () => null,
  LogoutOutlined: () => null,
  MessageOutlined: () => null,
  MonitorOutlined: () => null,
  RightOutlined: () => null,
  SettingOutlined: () => null,
  SafetyOutlined: () => null,
  UserOutlined: () => null
}));

import { AppShell } from '@/app/layout/app-shell';

const defaultProps = {
  activeView: 'overview' as const,
  avatar: '',
  children: <div>Page Content</div>,
  displayName: 'Test User',
  onLogout: vi.fn(),
  onUserNavigate: vi.fn(),
  onNavigate: vi.fn()
};

describe('AppShell', () => {
  it('renders the shell layout', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-shell');
  });

  it('renders expanded class by default', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('is-expanded');
  });

  it('renders the topbar', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-topbar');
  });

  it('renders the brand title', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('RAG Ops 控制台');
    expect(html).toContain('Knowledge lifecycle command center');
  });

  it('renders display name', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('Test User');
  });

  it('renders children content', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('Page Content');
  });

  it('renders the sider', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-sider');
  });

  it('renders the collapse button', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-collapse');
  });

  it('renders the menu', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-menu');
  });

  it('renders the content area', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-content');
  });

  it('renders the workspace layout', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-workspace');
  });

  it('renders screen reader text', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-sr-only');
    expect(html).toContain('RAG 总览');
    expect(html).toContain('知识空间');
  });

  it('renders with chatLab activeView', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} activeView="chatLab" />);
    expect(html).toContain('knowledge-pro-shell');
  });

  it('renders with settings activeView', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} activeView="settings" />);
    expect(html).toContain('knowledge-pro-shell');
  });

  it('renders with no activeView', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} activeView={undefined} />);
    expect(html).toContain('knowledge-pro-shell');
  });

  it('renders dropdown menu for user', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('dropdown');
  });

  it('renders brand mark icon', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-brand-mark');
  });

  it('renders avatar in user button', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} />);
    expect(html).toContain('knowledge-pro-user');
    expect(html).toContain('knowledge-pro-user-avatar');
    expect(html).toContain('knowledge-pro-user-name');
  });

  it('renders with different display name', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} displayName="Alice" />);
    expect(html).toContain('Alice');
  });

  it('renders with avatar src', () => {
    const html = renderToStaticMarkup(<AppShell {...defaultProps} avatar="https://example.com/a.png" />);
    expect(html).toContain('https://example.com/a.png');
  });
});
