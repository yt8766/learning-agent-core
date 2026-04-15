import { describe, expect, it, vi } from 'vitest';

import { MemoryScrubberService } from '@agent/memory';

describe('MemoryScrubberService', () => {
  it('会把命中冲突校验的经验隔离', async () => {
    const repository = {
      list: vi.fn(async () => [
        {
          id: 'mem-1',
          type: 'fact',
          summary: '旧经验',
          content: 'Outdated content',
          tags: ['payment'],
          createdAt: '2026-03-28T00:00:00.000Z'
        }
      ]),
      quarantine: vi.fn(
        async (
          id: string,
          reason: string,
          evidenceRefs?: string[],
          category?: string,
          detail?: string,
          restoreSuggestion?: string
        ) => ({
          id,
          type: 'fact',
          summary: '旧经验',
          content: 'Outdated content',
          tags: ['payment'],
          quarantined: true,
          quarantineReason: reason,
          quarantineCategory: category,
          quarantineReasonDetail: detail,
          quarantineRestoreSuggestion: restoreSuggestion,
          quarantineEvidenceRefs: evidenceRefs,
          createdAt: '2026-03-28T00:00:00.000Z'
        })
      )
    };
    const validator = {
      validate: vi.fn(async () => ({
        memoryId: 'mem-1',
        shouldQuarantine: true,
        reason: 'conflicts_with_latest_rulebook',
        category: 'conflicts_with_official_docs' as const,
        detail: '与最新规则库冲突',
        restoreSuggestion: '核对最新官方规则后再恢复',
        evidenceRefs: ['evidence-1']
      }))
    };

    const service = new MemoryScrubberService(repository as never, validator);
    const result = await service.scrubRecent(5);

    expect(repository.quarantine).toHaveBeenCalledWith(
      'mem-1',
      'conflicts_with_latest_rulebook',
      ['evidence-1'],
      'conflicts_with_official_docs',
      '与最新规则库冲突',
      '核对最新官方规则后再恢复'
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'mem-1',
        quarantined: true,
        quarantineReason: 'conflicts_with_latest_rulebook'
      })
    ]);
  });
});
