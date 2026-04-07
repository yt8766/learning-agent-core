import { describe, expect, it, vi } from 'vitest';

import { MemoryController } from '../../src/memory/memory.controller';

function createController() {
  const memoryService = {
    search: vi.fn(dto => ({ scope: 'search', dto })),
    getById: vi.fn(id => ({ scope: 'getById', id })),
    invalidate: vi.fn((id, dto) => ({ scope: 'invalidate', id, dto })),
    supersede: vi.fn((id, dto) => ({ scope: 'supersede', id, dto })),
    restore: vi.fn(id => ({ scope: 'restore', id })),
    retire: vi.fn((id, dto) => ({ scope: 'retire', id, dto }))
  };

  return {
    controller: new MemoryController(memoryService as never),
    memoryService
  };
}

describe('MemoryController', () => {
  it('delegates all memory actions to the memory service', () => {
    const { controller, memoryService } = createController();

    expect(controller.search({ query: 'runtime state' } as any)).toEqual({
      scope: 'search',
      dto: { query: 'runtime state' }
    });
    expect(controller.getById('mem-1')).toEqual({ scope: 'getById', id: 'mem-1' });
    expect(controller.invalidate('mem-1', { reason: 'stale' } as any)).toEqual({
      scope: 'invalidate',
      id: 'mem-1',
      dto: { reason: 'stale' }
    });
    expect(controller.supersede('mem-1', { supersededById: 'mem-2' } as any)).toEqual({
      scope: 'supersede',
      id: 'mem-1',
      dto: { supersededById: 'mem-2' }
    });
    expect(controller.restore('mem-1')).toEqual({ scope: 'restore', id: 'mem-1' });
    expect(controller.retire('mem-1', { reason: 'obsolete' } as any)).toEqual({
      scope: 'retire',
      id: 'mem-1',
      dto: { reason: 'obsolete' }
    });

    expect(memoryService.search).toHaveBeenCalledWith({ query: 'runtime state' });
    expect(memoryService.getById).toHaveBeenCalledWith('mem-1');
    expect(memoryService.invalidate).toHaveBeenCalledWith('mem-1', { reason: 'stale' });
    expect(memoryService.supersede).toHaveBeenCalledWith('mem-1', { supersededById: 'mem-2' });
    expect(memoryService.restore).toHaveBeenCalledWith('mem-1');
    expect(memoryService.retire).toHaveBeenCalledWith('mem-1', { reason: 'obsolete' });
  });
});
