import { describe, it, expect, vi } from 'vitest';
import { processCategory } from '../../../src/runtime/briefings/runtime-tech-briefing-category-runner';

vi.mock('../../../src/runtime/briefings/runtime-tech-briefing-sources', () => ({
  BRIEFING_CATEGORY_TITLES: {
    'ai-tech': 'AI & LLM 技术'
  }
}));

vi.mock('../../../src/runtime/briefings/runtime-tech-briefing-source-summary', () => ({
  BRIEFING_CATEGORY_SOURCE_LABELS: {
    'ai-tech': ['OpenAI Blog', 'Anthropic Blog']
  }
}));

vi.mock('../../../src/runtime/briefings/runtime-tech-briefing-category-processor', () => ({
  buildSuppressedSummary: vi.fn(() => ''),
  decideItemForSend: vi.fn((item: { id: string }) => ({ ...item, decisionReason: 'send_new' })),
  limitCategoryItems: vi.fn((items: Array<{ id: string }>) => ({
    displayedItems: items,
    displayedItemIds: new Set(items.map((i: { id: string }) => i.id))
  })),
  mergeSameRunItems: vi.fn((items: unknown[]) => ({ primaryItems: items, sameRunMergedCount: 0 })),
  toAuditRecord: vi.fn((item: unknown, displayed: boolean) => ({ ...(item as object), displayed }))
}));

describe('processCategory', () => {
  const now = new Date('2026-04-15T10:00:00.000Z');

  it('returns a successful result with collected items', async () => {
    const items = [
      { id: 'item-1', title: 'Title 1', messageKey: 'key-1' },
      { id: 'item-2', title: 'Title 2', messageKey: 'key-2' }
    ];
    const collectItems = vi.fn().mockResolvedValue(items);

    const result = await processCategory('ai-tech', now, new Map(), {
      collectItems,
      briefingSettings: { duplicateWindowDays: 7 } as never
    });

    expect(result.category).toBe('ai-tech');
    expect(result.title).toBe('AI & LLM 技术 | 2026-04-15');
    expect(result.status).toBe('sent');
    expect(result.itemCount).toBe(2);
    expect(result.displayedItemCount).toBe(2);
    expect(result.sourcesChecked).toEqual(['OpenAI Blog', 'Anthropic Blog']);
    expect(collectItems).toHaveBeenCalledWith('ai-tech', now);
  });

  it('returns empty result when no items are collected', async () => {
    const collectItems = vi.fn().mockResolvedValue([]);

    const result = await processCategory('ai-tech', now, new Map(), {
      collectItems,
      briefingSettings: { duplicateWindowDays: 7 } as never
    });

    expect(result.status).toBe('empty');
    expect(result.emptyDigest).toBe(true);
    expect(result.itemCount).toBe(0);
  });

  it('returns failed result when collection throws', async () => {
    const collectItems = vi.fn().mockRejectedValue(new Error('network timeout'));

    const result = await processCategory('ai-tech', now, new Map(), {
      collectItems,
      briefingSettings: { duplicateWindowDays: 7 } as never
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('network timeout');
    expect(result.itemCount).toBe(0);
    expect(result.displayedItems).toEqual([]);
  });
});
