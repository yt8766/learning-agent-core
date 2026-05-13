import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/admin-api', () => ({
  getMemoryUsageInsights: vi.fn()
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  let effectCb: (() => void) | undefined;
  return {
    ...actual,
    useEffect: (cb: () => void) => {
      effectCb = cb;
    },
    __runEffect: () => effectCb?.()
  };
});

import { MemoryUsageInsightCard } from '@/pages/learning-center/memory-usage-insight-card';

describe('MemoryUsageInsightCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with loading state initially', () => {
    const html = renderToStaticMarkup(<MemoryUsageInsightCard />);

    expect(html).toContain('Usage Insight');
    expect(html).toContain('memories 0');
    expect(html).toContain('retrieved 0');
  });

  it('renders metric badges with default zero values', () => {
    const html = renderToStaticMarkup(<MemoryUsageInsightCard />);

    expect(html).toContain('memories 0');
    expect(html).toContain('retrieved 0');
    expect(html).toContain('injected 0');
    expect(html).toContain('adopted 0');
    expect(html).toContain('dismissed 0');
    expect(html).toContain('corrected 0');
    expect(html).toContain('adoption rate 0%');
  });

  it('renders empty state messages', () => {
    const html = renderToStaticMarkup(<MemoryUsageInsightCard />);

    expect(html).toContain('暂无聚合 adoption 数据');
    expect(html).toContain('暂无 status 分布数据');
    expect(html).toContain('暂无命中');
  });

  it('renders global metrics badge', () => {
    const html = renderToStaticMarkup(<MemoryUsageInsightCard />);

    expect(html).toContain('global metrics');
  });
});
