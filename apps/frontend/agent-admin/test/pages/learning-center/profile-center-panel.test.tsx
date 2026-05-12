import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/admin-api', () => ({
  getProfile: vi.fn(),
  patchProfile: vi.fn()
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span className="badge" data-variant={variant ?? ''}>
      {children}
    </span>
  )
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, size, variant, disabled }: any) => (
    <button className={`btn ${size ?? ''} ${variant ?? ''}`} disabled={disabled}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={`card ${className ?? ''}`}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={`card-content ${className ?? ''}`}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={`card-header ${className ?? ''}`}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={`card-title ${className ?? ''}`}>{children}</h3>
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, placeholder }: any) => <input value={value ?? ''} placeholder={placeholder ?? ''} />
}));

import { ProfileCenterPanel } from '@/pages/learning-center/profile-center-panel';

describe('ProfileCenterPanel', () => {
  it('renders initial state with lookup form', () => {
    const html = renderToStaticMarkup(<ProfileCenterPanel />);

    expect(html).toContain('画像中枢');
    expect(html).toContain('查询画像');
    expect(html).toContain('输入 user id');
    expect(html).toContain('画像查询 / 修改');
  });

  it('does not render profile data initially', () => {
    const html = renderToStaticMarkup(<ProfileCenterPanel />);

    expect(html).not.toContain('更新画像');
    expect(html).not.toContain('沟通风格');
  });

  it('does not render profile article initially', () => {
    const html = renderToStaticMarkup(<ProfileCenterPanel />);

    expect(html).not.toContain('操作人 agent-admin-user');
  });

  it('does not render draft form initially', () => {
    const html = renderToStaticMarkup(<ProfileCenterPanel />);

    expect(html).not.toContain('执行风格');
    expect(html).not.toContain('审批风格');
  });

  it('renders the query button', () => {
    const html = renderToStaticMarkup(<ProfileCenterPanel />);

    expect(html).toContain('查询画像');
  });
});
