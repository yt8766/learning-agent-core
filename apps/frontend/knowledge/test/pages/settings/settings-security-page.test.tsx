/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-knowledge-governance', () => ({
  useSettingsSecurity: vi.fn(() => ({
    loading: false,
    security: {
      securityScore: 85,
      encryption: { transport: 'TLS 1.3', atRest: 'AES-256' },
      passwordPolicy: '强密码策略',
      ipAllowlist: ['10.0.0.0/8'],
      ssoEnabled: true,
      mfaRequired: true,
      ipAllowlistEnabled: false,
      auditLogEnabled: true
    }
  }))
}));

vi.mock('@/pages/shared/ui', () => ({
  RagOpsPage: ({ children, title, subTitle, eyebrow }: any) => (
    <section className="rag-ops-page">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  )
}));

vi.mock('antd', () => {
  const Descriptions = ({ children }: any) => <dl className="descriptions">{children}</dl>;
  Descriptions.Item = ({ children, label }: any) => (
    <div className="desc-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );

  return {
    Card: ({ children, className, title }: any) => (
      <div className={`card ${className ?? ''}`}>
        {title ? <h3>{title}</h3> : null}
        {children}
      </div>
    ),
    Col: ({ children }: any) => <div className="col">{children}</div>,
    Descriptions,
    Progress: ({ percent, type }: any) => <div className="progress" data-percent={percent} data-type={type}></div>,
    Row: ({ children }: any) => <div className="row">{children}</div>,
    Space: ({ children }: any) => <div className="space">{children}</div>,
    Switch: ({ checked, size }: any) => <span className="switch" data-checked={checked} data-size={size}></span>,
    Tag: ({ children, color }: any) => (
      <span className="tag" data-color={color}>
        {children}
      </span>
    ),
    Typography: {
      Text: ({ children, type }: any) => <span data-type={type}>{children}</span>
    }
  };
});

vi.mock('@ant-design/icons', () => ({
  LockOutlined: () => null,
  SafetyOutlined: () => null
}));

import { SettingsSecurityPage } from '@/pages/settings/settings-security-page';

describe('SettingsSecurityPage', () => {
  it('renders the page title', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('安全策略');
    expect(html).toContain('Security Policy');
  });

  it('renders the subtitle', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('配置访问控制、审批门、密钥审计和知识空间安全策略');
  });

  it('renders the security score card', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('安全评分');
    expect(html).toContain('progress');
  });

  it('renders encryption details', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('传输加密');
    expect(html).toContain('静态加密');
  });

  it('renders password policy', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('密码策略');
    expect(html).toContain('强密码策略');
  });

  it('renders IP allowlist', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('IP 白名单');
  });

  it('renders policy toggles', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('SSO 登录');
    expect(html).toContain('MFA 强制校验');
    expect(html).toContain('审计日志');
  });

  it('renders audit coverage section', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('审计覆盖');
    expect(html).toContain('知识库权限变更');
    expect(html).toContain('API Key 创建与撤销');
    expect(html).toContain('高风险审批恢复');
  });

  it('renders evidence center note', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('Evidence Center');
  });

  it('renders the panel cards', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('rag-ops-panel');
  });

  it('renders switch components for toggles', () => {
    const html = renderToStaticMarkup(<SettingsSecurityPage />);
    expect(html).toContain('switch');
  });
});
