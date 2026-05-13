import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/admin-api', () => ({
  getMemoryHistory: vi.fn()
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

vi.mock('@/components/dashboard-center-shell', () => ({
  DashboardEmptyState: ({ message }: { message: string }) => <div>EmptyState:{message}</div>
}));

vi.mock('@/pages/learning-center/memory-insight-card', () => ({
  MemoryInsightCard: ({ title }: { title?: string }) => <div>MemoryInsightCard:{title ?? 'default'}</div>
}));

import { MemoryResolutionQueueCard } from '@/pages/learning-center/memory-resolution-queue-card';
import type { LearningCenterRecord } from '@/types/admin';

type Candidate = NonNullable<LearningCenterRecord['memoryResolutionCandidates']>[number];

const baseCandidate: Candidate = {
  id: 'cand-1',
  challengerId: 'mem-challenger',
  incumbentId: 'mem-incumbent',
  conflictKind: 'duplicate',
  suggestedAction: 'merge_both',
  confidence: 0.85,
  rationale: 'Both memories describe the same preference',
  resolution: 'pending',
  requiresHumanReview: false,
  createdAt: '2026-05-01T00:00:00.000Z'
};

describe('MemoryResolutionQueueCard', () => {
  it('renders empty state when no candidates', () => {
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={[]} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('Memory Resolution Queue');
    expect(html).toContain('当前没有待处理的 memory 决议候选');
  });

  it('renders empty state when candidates is null', () => {
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={null as any} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('当前没有待处理的 memory 决议候选');
  });

  it('renders count badge', () => {
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={[]} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('0');
  });

  it('renders candidates with conflict details', () => {
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={[baseCandidate]} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('duplicate');
    expect(html).toContain('merge');
    expect(html).toContain('0.85');
    expect(html).toContain('mem-challenger vs mem-incumbent');
    expect(html).toContain('Both memories describe the same preference');
  });

  it('renders resolution status badge', () => {
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={[baseCandidate]} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('pending');
  });

  it('renders accepted resolution badge', () => {
    const candidate: Candidate = { ...baseCandidate, resolution: 'accepted' };
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={[candidate]} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('accepted');
  });

  it('renders rejected resolution badge', () => {
    const candidate: Candidate = { ...baseCandidate, resolution: 'rejected' };
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={[candidate]} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('rejected');
  });

  it('renders requiresHumanReview warning badge', () => {
    const candidate: Candidate = { ...baseCandidate, requiresHumanReview: true };
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={[candidate]} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('warning');
  });

  it('renders action buttons', () => {
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={[baseCandidate]} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('查看详情');
    expect(html).toContain('接受决议');
    expect(html).toContain('驳回');
  });

  it('renders multiple candidates', () => {
    const candidates: Candidate[] = [baseCandidate, { ...baseCandidate, id: 'cand-2', conflictKind: 'contradiction' }];
    const html = renderToStaticMarkup(
      <MemoryResolutionQueueCard candidates={candidates} loading={false} onResolve={vi.fn()} />
    );

    expect(html).toContain('duplicate');
    expect(html).toContain('contradiction');
  });
});
