import { describe, expect, it, vi } from 'vitest';

import type { InvalidateKnowledgeDto, RetireKnowledgeDto, SearchMemoryDto, SupersedeKnowledgeDto } from '@agent/shared';

import { MemoryService } from '../../src/memory/memory.service';

describe('MemoryService', () => {
  it('delegates memory actions to RuntimeKnowledgeService', () => {
    const runtimeKnowledgeService = {
      searchMemory: vi.fn(),
      getMemory: vi.fn(),
      invalidateMemory: vi.fn(),
      supersedeMemory: vi.fn(),
      restoreMemory: vi.fn(),
      retireMemory: vi.fn()
    };
    const service = new MemoryService(runtimeKnowledgeService as any);
    const searchDto = { query: 'deploy' } as SearchMemoryDto;
    const invalidateDto = { reason: 'stale' } as InvalidateKnowledgeDto;
    const supersedeDto = { replacementId: 'memory-2', reason: 'updated' } as SupersedeKnowledgeDto;
    const retireDto = { reason: 'archived' } as RetireKnowledgeDto;

    service.search(searchDto);
    service.getById('memory-1');
    service.invalidate('memory-1', invalidateDto);
    service.supersede('memory-1', supersedeDto);
    service.restore('memory-1');
    service.retire('memory-1', retireDto);

    expect(runtimeKnowledgeService.searchMemory).toHaveBeenCalledWith(searchDto);
    expect(runtimeKnowledgeService.getMemory).toHaveBeenCalledWith('memory-1');
    expect(runtimeKnowledgeService.invalidateMemory).toHaveBeenCalledWith('memory-1', invalidateDto);
    expect(runtimeKnowledgeService.supersedeMemory).toHaveBeenCalledWith('memory-1', supersedeDto);
    expect(runtimeKnowledgeService.restoreMemory).toHaveBeenCalledWith('memory-1');
    expect(runtimeKnowledgeService.retireMemory).toHaveBeenCalledWith('memory-1', retireDto);
  });
});
