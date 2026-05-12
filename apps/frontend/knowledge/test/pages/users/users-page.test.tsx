/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antd', () => ({
  Avatar: ({ children, src, icon }: any) => (
    <span data-src={src}>
      {children}
      {icon}
    </span>
  ),
  Button: ({ children, icon, type }: any) => (
    <button type={type}>
      {icon}
      {children}
    </button>
  ),
  Card: ({ children, className, title }: any) => (
    <div className={className} data-title={title}>
      {children}
    </div>
  ),
  Input: ({ placeholder }: any) => <input placeholder={placeholder} />,
  Layout: {
    Content: ({ children, className }: any) => <div className={className}>{children}</div>,
    Header: ({ children, className }: any) => <header className={className}>{children}</header>,
    Sider: ({ children, className }: any) => <aside className={className}>{children}</aside>
  },
  Menu: ({ items }: any) => <nav>{items}</nav>,
  Space: ({ children }: any) => <div>{children}</div>,
  Statistic: ({ title, value, suffix }: any) => (
    <div>
      <span>{title}</span>
      <span>{value}</span>
      {suffix ? <span>{suffix}</span> : null}
    </div>
  ),
  Table: ({ dataSource, loading, rowKey }: any) => (
    <div data-loading={loading} data-rowkey={rowKey}>
      {dataSource?.map((item: any) => (
        <div key={item[rowKey]}>{item.name}</div>
      ))}
    </div>
  ),
  Tag: ({ children, color }: any) => <span data-color={color}>{children}</span>,
  Typography: {
    Text: ({ children, strong, type, className }: any) => {
      if (strong) return <strong className={className}>{children}</strong>;
      return (
        <span className={className} data-type={type}>
          {children}
        </span>
      );
    },
    Title: ({ children, level, className }: any) => (
      <div className={className} data-level={level}>
        {children}
      </div>
    )
  }
}));

vi.mock('@ant-design/icons', () => ({
  AppstoreOutlined: () => 'AppstoreOutlined',
  MoreOutlined: () => 'MoreOutlined',
  PlusOutlined: () => 'PlusOutlined',
  SearchOutlined: () => 'SearchOutlined'
}));

vi.mock('@/hooks/use-knowledge-governance', () => ({
  useWorkspaceUsers: vi.fn(() => ({
    data: {
      summary: {
        activeUsers: 5,
        adminUsers: 2,
        pendingUsers: 1,
        totalUsers: 8
      }
    },
    loading: false,
    users: [
      {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'admin',
        department: 'Engineering',
        status: 'active',
        avatarUrl: 'https://example.com/alice.jpg',
        kbAccessCount: 3,
        queryCount: 150,
        lastActiveAt: '2026-05-01T10:00:00Z'
      },
      {
        id: 'user-2',
        name: 'Bob',
        email: 'bob@example.com',
        role: 'editor',
        department: 'Marketing',
        status: 'pending',
        avatarUrl: '',
        kbAccessCount: 1,
        queryCount: 0,
        lastActiveAt: null
      }
    ]
  }))
}));

vi.mock('../shared/ui', () => ({
  MetricStrip: ({ metrics }: any) => (
    <div>
      {metrics?.map((m: any) => (
        <span key={m.key}>
          {m.label}: {m.value}
        </span>
      ))}
    </div>
  ),
  RagOpsPage: ({ children, title, subTitle, eyebrow, extra }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      <span>{eyebrow}</span>
      {extra}
      {children}
    </div>
  )
}));

import { UsersPage } from '@/pages/users/users-page';

describe('UsersPage', () => {
  it('renders page title and subtitle', () => {
    const html = renderToStaticMarkup(<UsersPage />);

    expect(html).toContain('访问治理');
    expect(html).toContain('管理成员、角色、知识空间访问范围和查询行为审计');
  });

  it('renders metrics strip', () => {
    const html = renderToStaticMarkup(<UsersPage />);

    expect(html).toContain('总用户数');
    expect(html).toContain('活跃用户');
    expect(html).toContain('管理员');
    expect(html).toContain('待激活');
  });

  it('renders invite user button', () => {
    const html = renderToStaticMarkup(<UsersPage />);

    expect(html).toContain('邀请用户');
  });

  it('renders search input', () => {
    const html = renderToStaticMarkup(<UsersPage />);

    expect(html).toContain('搜索用户...');
  });

  it('renders user table with data', () => {
    const html = renderToStaticMarkup(<UsersPage />);

    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
  });

  it('renders table card title', () => {
    const html = renderToStaticMarkup(<UsersPage />);

    expect(html).toContain('成员与知识空间权限');
  });
});
