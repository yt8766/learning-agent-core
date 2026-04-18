import { describe, expect, it, vi } from 'vitest';

import type { InvalidateKnowledgeDto, RetireKnowledgeDto, SupersedeKnowledgeDto } from '@agent/core';

import { RulesService } from '../../src/rules/rules.service';

describe('RulesService', () => {
  it('delegates rule actions to RuntimeKnowledgeService', () => {
    const runtimeKnowledgeService = {
      listRules: vi.fn(),
      invalidateRule: vi.fn(),
      supersedeRule: vi.fn(),
      restoreRule: vi.fn(),
      retireRule: vi.fn()
    };
    const service = new RulesService(runtimeKnowledgeService as any);
    const invalidateDto = { reason: 'stale' } as InvalidateKnowledgeDto;
    const supersedeDto = { replacementId: 'rule-2', reason: 'updated' } as SupersedeKnowledgeDto;
    const retireDto = { reason: 'archived' } as RetireKnowledgeDto;

    service.list();
    service.invalidate('rule-1', invalidateDto);
    service.supersede('rule-1', supersedeDto);
    service.restore('rule-1');
    service.retire('rule-1', retireDto);

    expect(runtimeKnowledgeService.listRules).toHaveBeenCalledTimes(1);
    expect(runtimeKnowledgeService.invalidateRule).toHaveBeenCalledWith('rule-1', invalidateDto);
    expect(runtimeKnowledgeService.supersedeRule).toHaveBeenCalledWith('rule-1', supersedeDto);
    expect(runtimeKnowledgeService.restoreRule).toHaveBeenCalledWith('rule-1');
    expect(runtimeKnowledgeService.retireRule).toHaveBeenCalledWith('rule-1', retireDto);
  });
});
