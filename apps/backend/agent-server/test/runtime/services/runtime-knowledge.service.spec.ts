import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { MemoryScrubberValidator } from '@agent/memory';

import { RuntimeKnowledgeService } from '../../../src/runtime/services/runtime-knowledge.service';

describe('RuntimeKnowledgeService', () => {
  const createService = () => {
    const memoryRepository = {
      search: vi.fn(async () => [{ id: 'memory-1' }]),
      list: vi.fn(async () => [{ id: 'memory-1' }]),
      getById: vi.fn(async (id: string) => (id === 'memory-1' ? { id } : undefined)),
      invalidate: vi.fn(async (id: string, reason: string) =>
        id === 'memory-1' ? { id, status: 'invalidated', invalidationReason: reason } : undefined
      ),
      supersede: vi.fn(async (id: string, replacementId: string, reason: string) =>
        id === 'memory-1'
          ? { id, status: 'superseded', supersededById: replacementId, invalidationReason: reason }
          : undefined
      ),
      restore: vi.fn(async (id: string) => (id === 'memory-1' ? { id, status: 'active' } : undefined)),
      retire: vi.fn(async (id: string, reason: string) =>
        id === 'memory-1' ? { id, status: 'retired', invalidationReason: reason } : undefined
      ),
      quarantine: vi.fn(
        async (
          id: string,
          reason: string,
          evidenceRefs?: string[],
          category?: string,
          detail?: string,
          restoreSuggestion?: string
        ) =>
          id === 'memory-1'
            ? {
                id,
                quarantined: true,
                quarantineReason: reason,
                quarantineCategory: category,
                quarantineReasonDetail: detail,
                quarantineRestoreSuggestion: restoreSuggestion,
                quarantineEvidenceRefs: evidenceRefs
              }
            : undefined
      )
    };
    const ruleRepository = {
      invalidate: vi.fn(async (id: string, reason: string) =>
        id === 'rule-1' ? { id, status: 'invalidated', invalidationReason: reason } : undefined
      ),
      supersede: vi.fn(async (id: string, replacementId: string, reason: string) =>
        id === 'rule-1'
          ? { id, status: 'superseded', supersededById: replacementId, invalidationReason: reason }
          : undefined
      ),
      restore: vi.fn(async (id: string) => (id === 'rule-1' ? { id, status: 'active' } : undefined)),
      retire: vi.fn(async (id: string, reason: string) =>
        id === 'rule-1' ? { id, status: 'retired', invalidationReason: reason } : undefined
      )
    };
    const orchestrator = {
      listRules: vi.fn(() => [{ id: 'rule-1' }])
    };
    let runtimeStateSnapshot = {
      crossCheckEvidence: []
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => runtimeStateSnapshot),
      save: vi.fn(async (snapshot: typeof runtimeStateSnapshot) => {
        runtimeStateSnapshot = snapshot;
      })
    };

    return {
      service: new RuntimeKnowledgeService(() => ({
        memoryRepository,
        ruleRepository,
        orchestrator,
        runtimeStateRepository
      })),
      memoryRepository,
      ruleRepository,
      orchestrator,
      runtimeStateRepository
    };
  };

  it('处理 memory 与 rule 的正常读写', async () => {
    const { service, orchestrator, memoryRepository, ruleRepository } = createService();

    expect(await service.searchMemory({ query: 'agent' })).toEqual([{ id: 'memory-1' }]);
    expect(await service.getMemory('memory-1')).toEqual({ id: 'memory-1' });
    expect(await service.invalidateMemory('memory-1', { reason: 'stale' })).toEqual({
      id: 'memory-1',
      status: 'invalidated',
      invalidationReason: 'stale'
    });
    expect(await service.supersedeMemory('memory-1', { replacementId: 'memory-2', reason: 'newer' })).toEqual({
      id: 'memory-1',
      status: 'superseded',
      supersededById: 'memory-2',
      invalidationReason: 'newer'
    });
    expect(await service.restoreMemory('memory-1')).toEqual({ id: 'memory-1', status: 'active' });
    expect(await service.retireMemory('memory-1', { reason: 'cleanup' })).toEqual({
      id: 'memory-1',
      status: 'retired',
      invalidationReason: 'cleanup'
    });
    expect(await service.listMemories()).toEqual([{ id: 'memory-1' }]);
    expect(await service.quarantineMemory('memory-1', 'bad-memory', ['e1'])).toEqual({
      id: 'memory-1',
      quarantined: true,
      quarantineReason: 'bad-memory',
      quarantineEvidenceRefs: ['e1']
    });
    expect(service.listRules()).toEqual([{ id: 'rule-1' }]);
    expect(await service.invalidateRule('rule-1', { reason: 'conflict' })).toEqual({
      id: 'rule-1',
      status: 'invalidated',
      invalidationReason: 'conflict'
    });
    expect(await service.supersedeRule('rule-1', { replacementId: 'rule-2', reason: 'updated' })).toEqual({
      id: 'rule-1',
      status: 'superseded',
      supersededById: 'rule-2',
      invalidationReason: 'updated'
    });
    expect(await service.restoreRule('rule-1')).toEqual({ id: 'rule-1', status: 'active' });
    expect(await service.retireRule('rule-1', { reason: 'cleanup' })).toEqual({
      id: 'rule-1',
      status: 'retired',
      invalidationReason: 'cleanup'
    });

    expect(memoryRepository.search).toHaveBeenCalledWith('agent', 10);
    expect(memoryRepository.list).toHaveBeenCalledTimes(1);
    expect(orchestrator.listRules).toHaveBeenCalledTimes(1);
    expect(ruleRepository.supersede).toHaveBeenCalledWith('rule-1', 'rule-2', 'updated');
  });

  it('可创建 memory scrubber 并复用 repository', async () => {
    const { service, memoryRepository } = createService();
    const validator: MemoryScrubberValidator = {
      validate: vi.fn(async () => null)
    };

    const scrubber = service.createMemoryScrubber(validator);
    await scrubber.scrubRecent(5);

    expect(memoryRepository.list).toHaveBeenCalled();
    expect(validator.validate).toHaveBeenCalled();
  });

  it('可记录并读取 cross-check EvidenceRecord', async () => {
    const { service, runtimeStateRepository } = createService();
    const records = [
      {
        id: 'official-rule:1',
        taskId: 'memory:memory-1',
        sourceId: 'official-rule:1',
        sourceType: 'official_rule',
        trustClass: 'official',
        summary: '官方规则冲突',
        detail: { reason: 'demo' },
        createdAt: '2026-03-28T00:00:00.000Z',
        fetchedAt: '2026-03-28T00:00:00.000Z'
      }
    ];

    await expect(service.recordCrossCheckEvidence('memory-1', records as any)).resolves.toEqual(records);
    await expect(service.listCrossCheckEvidence('memory-1')).resolves.toEqual([
      {
        memoryId: 'memory-1',
        record: records[0]
      }
    ]);
    expect(runtimeStateRepository.save).toHaveBeenCalledTimes(1);
  });

  it('对缺失 memory/rule 抛出 NotFoundException', async () => {
    const { service } = createService();

    await expect(service.getMemory('missing-memory')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.invalidateRule('missing-rule', { reason: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
