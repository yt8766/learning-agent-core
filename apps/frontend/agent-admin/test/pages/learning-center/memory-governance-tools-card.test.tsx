import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/admin-api', () => ({
  getMemoryHistory: vi.fn(),
  getProfile: vi.fn(),
  overrideMemory: vi.fn(),
  patchProfile: vi.fn(),
  rollbackMemory: vi.fn()
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

vi.mock('@/pages/learning-center/memory-insight-card', () => ({
  MemoryInsightCard: ({ title }: { title?: string }) => <div>MemoryInsightCard:{title ?? 'default'}</div>
}));

import { MemoryGovernanceToolsCard } from '@/pages/learning-center/memory-governance-tools-card';

describe('MemoryGovernanceToolsCard', () => {
  it('renders initial state with lookup sections', () => {
    const html = renderToStaticMarkup(<MemoryGovernanceToolsCard />);

    expect(html).toContain('Memory Governance Tools');
    expect(html).toContain('Profile Lookup');
    expect(html).toContain('Memory History Lookup');
    expect(html).toContain('查询画像');
    expect(html).toContain('查询历史');
    expect(html).toContain('profile / history');
  });

  it('renders input placeholders', () => {
    const html = renderToStaticMarkup(<MemoryGovernanceToolsCard />);

    expect(html).toContain('输入 user id');
    expect(html).toContain('输入 memory id');
  });

  it('does not render profile data initially', () => {
    const html = renderToStaticMarkup(<MemoryGovernanceToolsCard />);

    expect(html).not.toContain('更新画像');
    expect(html).not.toContain('覆写当前 memory');
  });

  it('does not render profile article section initially', () => {
    const html = renderToStaticMarkup(<MemoryGovernanceToolsCard />);

    expect(html).not.toContain('communication:');
    expect(html).not.toContain('execution:');
  });

  it('does not render memory history article section initially', () => {
    const html = renderToStaticMarkup(<MemoryGovernanceToolsCard />);

    expect(html).not.toContain('MemoryInsightCard');
  });

  it('does not render profile draft inputs initially', () => {
    const html = renderToStaticMarkup(<MemoryGovernanceToolsCard />);

    expect(html).not.toContain('communication style');
    expect(html).not.toContain('execution style');
  });

  it('does not render override section initially', () => {
    const html = renderToStaticMarkup(<MemoryGovernanceToolsCard />);

    expect(html).not.toContain('replacement summary');
  });
});
