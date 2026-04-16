import { describe, expect, it, vi } from 'vitest';

import type {
  InvalidateKnowledgeDto,
  MemoryFeedbackDto,
  OverrideMemoryDto,
  PatchUserProfileDto,
  ResolveResolutionCandidateDto,
  RetireKnowledgeDto,
  RollbackMemoryDto,
  SearchMemoryDto,
  SupersedeKnowledgeDto
} from '@agent/shared';

import { MemoryService } from '../../src/memory/memory.service';

describe('MemoryService', () => {
  it('delegates memory actions to RuntimeKnowledgeService', () => {
    const runtimeKnowledgeService = {
      searchMemory: vi.fn(),
      getMemory: vi.fn(),
      invalidateMemory: vi.fn(),
      supersedeMemory: vi.fn(),
      restoreMemory: vi.fn(),
      retireMemory: vi.fn(),
      getMemoryHistory: vi.fn(),
      getMemoryUsageInsights: vi.fn(),
      compareMemoryVersions: vi.fn(),
      listMemoryEvidenceLinks: vi.fn(),
      overrideMemory: vi.fn(),
      rollbackMemory: vi.fn(),
      recordMemoryFeedback: vi.fn(),
      getProfile: vi.fn(),
      patchProfile: vi.fn(),
      listResolutionCandidates: vi.fn(),
      resolveResolutionCandidate: vi.fn()
    };
    const service = new MemoryService(runtimeKnowledgeService as any);
    const searchDto = { query: 'deploy' } as SearchMemoryDto;
    const invalidateDto = { reason: 'stale' } as InvalidateKnowledgeDto;
    const supersedeDto = { replacementId: 'memory-2', reason: 'updated' } as SupersedeKnowledgeDto;
    const retireDto = { reason: 'archived' } as RetireKnowledgeDto;
    const overrideDto = { summary: 'manual only', content: 'manual only', reason: 'corrected' } as OverrideMemoryDto;
    const rollbackDto = { version: 1 } as RollbackMemoryDto;
    const feedbackDto = { kind: 'adopted' } as MemoryFeedbackDto;
    const profileDto = { communicationStyle: 'concise' } as PatchUserProfileDto;
    const resolutionDto = { resolution: 'accepted' } as ResolveResolutionCandidateDto;

    service.search(searchDto);
    service.getById('memory-1');
    service.history('memory-1');
    service.usageInsights();
    service.compare('memory-1', 2, 5);
    service.evidenceLinks('memory-1');
    service.invalidate('memory-1', invalidateDto);
    service.supersede('memory-1', supersedeDto);
    service.restore('memory-1');
    service.retire('memory-1', retireDto);
    service.override('memory-1', overrideDto);
    service.rollback('memory-1', rollbackDto);
    service.feedback('memory-1', feedbackDto);
    service.getProfile('user-1');
    service.patchProfile('user-1', profileDto);
    service.listResolutionCandidates();
    service.resolveResolutionCandidate('resolution-1', resolutionDto);

    expect(runtimeKnowledgeService.searchMemory).toHaveBeenCalledWith(searchDto);
    expect(runtimeKnowledgeService.getMemory).toHaveBeenCalledWith('memory-1');
    expect(runtimeKnowledgeService.getMemoryHistory).toHaveBeenCalledWith('memory-1');
    expect(runtimeKnowledgeService.getMemoryUsageInsights).toHaveBeenCalledWith();
    expect(runtimeKnowledgeService.compareMemoryVersions).toHaveBeenCalledWith('memory-1', 2, 5);
    expect(runtimeKnowledgeService.listMemoryEvidenceLinks).toHaveBeenCalledWith('memory-1');
    expect(runtimeKnowledgeService.invalidateMemory).toHaveBeenCalledWith('memory-1', invalidateDto);
    expect(runtimeKnowledgeService.supersedeMemory).toHaveBeenCalledWith('memory-1', supersedeDto);
    expect(runtimeKnowledgeService.restoreMemory).toHaveBeenCalledWith('memory-1');
    expect(runtimeKnowledgeService.retireMemory).toHaveBeenCalledWith('memory-1', retireDto);
    expect(runtimeKnowledgeService.overrideMemory).toHaveBeenCalledWith('memory-1', overrideDto);
    expect(runtimeKnowledgeService.rollbackMemory).toHaveBeenCalledWith('memory-1', rollbackDto);
    expect(runtimeKnowledgeService.recordMemoryFeedback).toHaveBeenCalledWith('memory-1', feedbackDto);
    expect(runtimeKnowledgeService.getProfile).toHaveBeenCalledWith('user-1');
    expect(runtimeKnowledgeService.patchProfile).toHaveBeenCalledWith('user-1', profileDto);
    expect(runtimeKnowledgeService.listResolutionCandidates).toHaveBeenCalledWith();
    expect(runtimeKnowledgeService.resolveResolutionCandidate).toHaveBeenCalledWith('resolution-1', resolutionDto);
  });
});
