import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { stateQueue } = vi.hoisted(() => ({
  stateQueue: [] as unknown[]
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: ((initialValue: unknown) => {
      if (stateQueue.length > 0) {
        return stateQueue.shift() as [unknown, ReturnType<typeof vi.fn>];
      }
      return [initialValue, vi.fn()];
    }) as unknown as typeof actual.useState
  };
});

vi.mock('@/api/admin-api', () => ({
  searchMemories: vi.fn(),
  getMemoryHistory: vi.fn(),
  getMemoryEvidenceLinks: vi.fn(async () => [])
}));

import { MemoryBrowserCard } from '@/pages/learning-center/memory-browser-card';

describe('MemoryBrowserCard', () => {
  beforeEach(() => {
    stateQueue.length = 0;
  });

  it('renders searched memories, ranking reasons and selected history snapshot', () => {
    stateQueue.push(
      ['deploy', vi.fn()],
      ['all', vi.fn()],
      ['all', vi.fn()],
      [false, vi.fn()],
      ['', vi.fn()],
      [
        {
          coreMemories: [
            {
              id: 'mem-1',
              summary: '项目 A 不要自动提交。',
              status: 'active',
              memoryType: 'constraint',
              scopeType: 'workspace',
              verificationStatus: 'verified',
              sourceEvidenceIds: ['ev-1'],
              usageMetrics: {
                retrievedCount: 3,
                injectedCount: 2,
                adoptedCount: 2,
                dismissedCount: 1,
                correctedCount: 1
              }
            }
          ],
          archivalMemories: [],
          rules: [],
          reflections: [],
          reasons: [
            {
              id: 'mem-1',
              kind: 'memory',
              summary: '项目 A 不要自动提交。',
              score: 0.91,
              reason: 'entity matched; same scope; strong relevance'
            }
          ]
        },
        vi.fn()
      ],
      [
        {
          memory: {
            id: 'mem-1',
            summary: '项目 A 不要自动提交。',
            status: 'active',
            memoryType: 'constraint',
            scopeType: 'workspace',
            verificationStatus: 'verified',
            sourceEvidenceIds: ['ev-1'],
            usageMetrics: {
              retrievedCount: 3,
              injectedCount: 2,
              adoptedCount: 2,
              dismissedCount: 1,
              correctedCount: 1
            }
          },
          events: [
            {
              id: 'evt-1',
              eventType: 'memory.created',
              memoryId: 'mem-1',
              version: 1,
              createdAt: '2026-04-16T00:00:00.000Z'
            }
          ]
        },
        vi.fn()
      ],
      ['mem-1', vi.fn()],
      [false, vi.fn()]
    );

    const html = renderToStaticMarkup(<MemoryBrowserCard />);

    expect(html).toContain('Memory Browser');
    expect(html).toContain('项目 A 不要自动提交。');
    expect(html).toContain('score 0.91');
    expect(html).toContain('reason: entity matched; same scope; strong relevance');
    expect(html).toContain('Memory Feedback Insight');
    expect(html).toContain('adopted 2');
    expect(html).toContain('dismissed 1');
    expect(html).toContain('corrected 1');
    expect(html).toContain('adoption rate 100%');
    expect(html).toContain('Selected Memory Snapshot');
    expect(html).toContain('memory.created');
  });
});
