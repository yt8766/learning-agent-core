/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-knowledge-governance', () => ({
  useSettingsApiKeys: vi.fn(() => ({
    apiKeys: [
      {
        id: 'key-1',
        name: 'Production Key',
        maskedKey: 'sk-liv...abcd',
        permissions: ['knowledge:read', 'knowledge:write'],
        createdAt: '2026-01-15T00:00:00.000Z',
        lastUsedAt: '2026-05-01T10:00:00.000Z',
        status: 'active'
      }
    ],
    loading: false
  }))
}));

vi.mock('@/pages/shared/ui', () => ({
  RagOpsPage: ({ children, title, subTitle, eyebrow, extra }: any) => (
    <section className="rag-ops-page">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {extra}
      {children}
    </section>
  )
}));

vi.mock('antd', () => ({
  Alert: ({ title, type }: any) => <div className={`alert alert-${type}`}>{title}</div>,
  Button: ({ children, type }: any) => <button className={`btn ${type ?? ''}`}>{children}</button>,
  Card: ({ children, className }: any) => <div className={`card ${className ?? ''}`}>{children}</div>,
  Space: ({ children }: any) => <div className="space">{children}</div>,
  Table: ({ dataSource }: any) => <table className="table" data-count={dataSource?.length ?? 0}></table>,
  Tag: ({ children, color }: any) => (
    <span className="tag" data-color={color}>
      {children}
    </span>
  ),
  Typography: {
    Text: ({ children, code, strong, type }: any) => (
      <span className={code ? 'code' : strong ? 'strong' : ''} data-type={type}>
        {children}
      </span>
    )
  }
}));

vi.mock('@ant-design/icons', () => ({
  EyeInvisibleOutlined: () => null,
  KeyOutlined: () => null,
  PlusOutlined: () => null
}));

import { SettingsKeysPage } from '@/pages/settings/settings-keys-page';

describe('SettingsKeysPage', () => {
  it('renders the page title', () => {
    const html = renderToStaticMarkup(<SettingsKeysPage />);
    expect(html).toContain('API 密钥');
    expect(html).toContain('Credentials');
  });

  it('renders the subtitle', () => {
    const html = renderToStaticMarkup(<SettingsKeysPage />);
    expect(html).toContain('管理外部调用知识库服务的访问密钥');
  });

  it('renders the security alert', () => {
    const html = renderToStaticMarkup(<SettingsKeysPage />);
    expect(html).toContain('API 密钥拥有账号授权范围内的知识库访问能力');
  });

  it('renders the new key button', () => {
    const html = renderToStaticMarkup(<SettingsKeysPage />);
    expect(html).toContain('新建密钥');
  });

  it('renders the table', () => {
    const html = renderToStaticMarkup(<SettingsKeysPage />);
    expect(html).toContain('table');
    expect(html).toContain('data-count="1"');
  });

  it('renders the table card', () => {
    const html = renderToStaticMarkup(<SettingsKeysPage />);
    expect(html).toContain('rag-ops-table-card');
  });
});
