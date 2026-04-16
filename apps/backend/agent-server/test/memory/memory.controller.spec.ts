import { describe, expect, it, vi } from 'vitest';

import { MemoryController } from '../../src/memory/memory.controller';

function createController() {
  const memoryService = {
    search: vi.fn(dto => ({ scope: 'search', dto })),
    getById: vi.fn(id => ({ scope: 'getById', id })),
    history: vi.fn(id => ({ scope: 'history', id })),
    usageInsights: vi.fn(() => ({ scope: 'usageInsights' })),
    compare: vi.fn((id, leftVersion, rightVersion) => ({ scope: 'compare', id, leftVersion, rightVersion })),
    evidenceLinks: vi.fn(id => ({ scope: 'evidenceLinks', id })),
    invalidate: vi.fn((id, dto) => ({ scope: 'invalidate', id, dto })),
    supersede: vi.fn((id, dto) => ({ scope: 'supersede', id, dto })),
    restore: vi.fn(id => ({ scope: 'restore', id })),
    retire: vi.fn((id, dto) => ({ scope: 'retire', id, dto })),
    override: vi.fn((id, dto) => ({ scope: 'override', id, dto })),
    rollback: vi.fn((id, dto) => ({ scope: 'rollback', id, dto })),
    feedback: vi.fn((id, dto) => ({ scope: 'feedback', id, dto })),
    getProfile: vi.fn(userId => ({ scope: 'getProfile', userId })),
    patchProfile: vi.fn((userId, dto) => ({ scope: 'patchProfile', userId, dto })),
    listResolutionCandidates: vi.fn(() => ({ scope: 'listResolutionCandidates' })),
    resolveResolutionCandidate: vi.fn((id, dto) => ({ scope: 'resolveResolutionCandidate', id, dto }))
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
    expect(controller.getProfile('user-1')).toEqual({ scope: 'getProfile', userId: 'user-1' });
    expect(controller.patchProfile('user-1', { communicationStyle: 'concise' } as any)).toEqual({
      scope: 'patchProfile',
      userId: 'user-1',
      dto: { communicationStyle: 'concise' }
    });
    expect(controller.listResolutionCandidates()).toEqual({ scope: 'listResolutionCandidates' });
    expect(controller.usageInsights()).toEqual({ scope: 'usageInsights' });
    expect(controller.resolveResolutionCandidate('resolution-1', { resolution: 'accepted' } as any)).toEqual({
      scope: 'resolveResolutionCandidate',
      id: 'resolution-1',
      dto: { resolution: 'accepted' }
    });
    expect(controller.history('mem-1')).toEqual({ scope: 'history', id: 'mem-1' });
    expect(controller.compare('mem-1', '2', '5')).toEqual({
      scope: 'compare',
      id: 'mem-1',
      leftVersion: 2,
      rightVersion: 5
    });
    expect(controller.evidenceLinks('mem-1')).toEqual({ scope: 'evidenceLinks', id: 'mem-1' });
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
    expect(controller.override('mem-1', { summary: 'manual', content: 'manual', reason: 'corrected' } as any)).toEqual({
      scope: 'override',
      id: 'mem-1',
      dto: { summary: 'manual', content: 'manual', reason: 'corrected' }
    });
    expect(controller.rollback('mem-1', { version: 1 } as any)).toEqual({
      scope: 'rollback',
      id: 'mem-1',
      dto: { version: 1 }
    });
    expect(controller.feedback('mem-1', { kind: 'adopted' } as any)).toEqual({
      scope: 'feedback',
      id: 'mem-1',
      dto: { kind: 'adopted' }
    });

    expect(memoryService.search).toHaveBeenCalledWith({ query: 'runtime state' });
    expect(memoryService.getProfile).toHaveBeenCalledWith('user-1');
    expect(memoryService.patchProfile).toHaveBeenCalledWith('user-1', { communicationStyle: 'concise' });
    expect(memoryService.listResolutionCandidates).toHaveBeenCalledWith();
    expect(memoryService.usageInsights).toHaveBeenCalledWith();
    expect(memoryService.resolveResolutionCandidate).toHaveBeenCalledWith('resolution-1', { resolution: 'accepted' });
    expect(memoryService.history).toHaveBeenCalledWith('mem-1');
    expect(memoryService.compare).toHaveBeenCalledWith('mem-1', 2, 5);
    expect(memoryService.evidenceLinks).toHaveBeenCalledWith('mem-1');
    expect(memoryService.getById).toHaveBeenCalledWith('mem-1');
    expect(memoryService.invalidate).toHaveBeenCalledWith('mem-1', { reason: 'stale' });
    expect(memoryService.supersede).toHaveBeenCalledWith('mem-1', { supersededById: 'mem-2' });
    expect(memoryService.restore).toHaveBeenCalledWith('mem-1');
    expect(memoryService.retire).toHaveBeenCalledWith('mem-1', { reason: 'obsolete' });
    expect(memoryService.override).toHaveBeenCalledWith('mem-1', {
      summary: 'manual',
      content: 'manual',
      reason: 'corrected'
    });
    expect(memoryService.rollback).toHaveBeenCalledWith('mem-1', { version: 1 });
    expect(memoryService.feedback).toHaveBeenCalledWith('mem-1', { kind: 'adopted' });
  });
});
