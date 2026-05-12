import { describe, expect, it, vi } from 'vitest';

vi.mock('@agent/core', async () => {
  const actual = await vi.importActual<any>('@agent/core');
  return {
    ...actual,
    CounselorSelectorConfigSchema: {
      safeParse: vi.fn().mockImplementation((data: any) => {
        if (data && data.enabled !== undefined) {
          return { success: true, data };
        }
        return { success: false, error: 'invalid' };
      })
    }
  };
});

vi.mock('../../../../../../src/memory/active-memory-tools', () => ({
  archivalMemorySearchByParams: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../../../../src/memory/runtime-memory-search', () => ({
  flattenStructuredMemories: vi.fn().mockReturnValue([])
}));

vi.mock('../../../../../../src/bridges/supervisor-runtime-bridge', () => ({
  resolveSpecialistRoute: vi.fn().mockReturnValue({
    specialistLead: { domain: 'general', displayName: 'General Specialist' },
    supportingSpecialists: []
  }),
  resolveWorkflowPreset: vi.fn().mockReturnValue({
    normalizedGoal: 'test goal',
    preset: { id: 'general', displayName: 'General', requiredMinistries: ['libu-governance'] }
  })
}));

vi.mock('../../../../../../src/governance/runtime-governance-store', () => ({
  getGovernanceProfiles: vi.fn().mockReturnValue([]),
  getCapabilityGovernanceProfiles: vi.fn().mockReturnValue([])
}));

import {
  resolveLifecycleKnowledgeReuse,
  applyLifecycleCounselorSelectorGovernance
} from '../../../../../../src/graphs/main/runtime/lifecycle/governance/main-graph-lifecycle-governance';

describe('main-graph-lifecycle-governance', () => {
  describe('resolveLifecycleKnowledgeReuse', () => {
    it('returns empty results when no structured search and no fallback memories', async () => {
      const deps = {
        taskId: 'task-1',
        runId: 'run-1',
        goal: 'test goal',
        createdAt: '2026-04-16T00:00:00.000Z',
        memoryRepository: { search: vi.fn().mockResolvedValue([]) },
        memorySearchService: undefined
      };

      const result = await resolveLifecycleKnowledgeReuse(deps);
      expect(result.memories).toEqual([]);
      expect(result.rules).toEqual([]);
      expect(result.reusedMemoryIds).toEqual([]);
      expect(result.reusedRuleIds).toEqual([]);
      expect(result.evidence).toEqual([]);
    });

    it('uses fallback memories when structured search returns null', async () => {
      const memories = [{ id: 'm1', summary: 'test memory', type: 'success_case', tags: ['test'], qualityScore: 0.8 }];
      const deps = {
        taskId: 'task-1',
        runId: 'run-1',
        goal: 'test goal',
        createdAt: '2026-04-16T00:00:00.000Z',
        memoryRepository: { search: vi.fn().mockResolvedValue(memories) },
        memorySearchService: undefined
      };

      const result = await resolveLifecycleKnowledgeReuse(deps);
      expect(result.memories).toEqual(memories);
      expect(result.reusedMemoryIds).toEqual(['m1']);
    });

    it('builds evidence entries for memories and rules', async () => {
      const { archivalMemorySearchByParams } = await import('../../../../../../src/memory/active-memory-tools');
      const { flattenStructuredMemories } = await import('../../../../../../src/memory/runtime-memory-search');

      vi.mocked(archivalMemorySearchByParams).mockResolvedValueOnce({
        memories: [],
        rules: [{ id: 'r1', summary: 'test rule', name: 'Rule 1', conditions: ['cond1'] }],
        reflections: [{ id: 'ref-1', summary: 'reflection', kind: 'failure', whatFailed: 'X', nextAttemptAdvice: 'Y' }],
        reasons: []
      } as any);
      vi.mocked(flattenStructuredMemories).mockReturnValueOnce([]);

      const deps = {
        taskId: 'task-1',
        runId: 'run-1',
        goal: 'test goal',
        createdAt: '2026-04-16T00:00:00.000Z',
        memoryRepository: { search: vi.fn().mockResolvedValue([]) },
        memorySearchService: {} as any
      };

      const result = await resolveLifecycleKnowledgeReuse(deps);
      expect(result.rules).toHaveLength(1);
      expect(result.reusedRuleIds).toEqual(['r1']);
      expect(result.evidence.length).toBeGreaterThanOrEqual(2); // rule + reflection
    });
  });

  describe('applyLifecycleCounselorSelectorGovernance', () => {
    it('returns dto unchanged when no matching counselor config', async () => {
      const dto = {
        goal: 'test',
        constraints: [],
        counselorSelector: { candidateIds: ['c1'] }
      } as any;
      const workflowResolution = {
        normalizedGoal: 'test goal',
        preset: { id: 'general', requiredMinistries: [] }
      } as any;
      const runtimeStateRepository = {
        load: vi.fn().mockResolvedValue({ governance: {} })
      } as any;

      const result = await applyLifecycleCounselorSelectorGovernance({
        dto,
        workflowResolution,
        runtimeStateRepository
      });

      expect(result.counselorSelector).toEqual(dto.counselorSelector);
    });

    it('applies matching counselor selector config when dto has no candidateIds', async () => {
      const config = {
        domain: 'general',
        enabled: true,
        strategy: 'weighted',
        candidateIds: ['agent-1', 'agent-2'],
        weights: { 'agent-1': 0.6, 'agent-2': 0.4 },
        defaultCounselorId: 'agent-1'
      };
      const dto = {
        goal: 'test',
        constraints: [],
        counselorSelector: {}
      } as any;
      const workflowResolution = {
        normalizedGoal: 'test goal',
        preset: { id: 'general', requiredMinistries: [] }
      } as any;
      const runtimeStateRepository = {
        load: vi.fn().mockResolvedValue({
          governance: { counselorSelectorConfigs: [config] }
        })
      } as any;

      const result = await applyLifecycleCounselorSelectorGovernance({
        dto,
        workflowResolution,
        runtimeStateRepository
      });

      expect(result.counselorSelector.candidateIds).toEqual(['agent-1', 'agent-2']);
      expect(result.counselorSelector.strategy).toBe('weighted');
    });

    it('skips disabled counselor configs', async () => {
      const config = {
        domain: 'general',
        enabled: false,
        strategy: 'weighted',
        candidateIds: ['agent-1']
      };
      const dto = {
        goal: 'test',
        constraints: [],
        counselorSelector: {}
      } as any;
      const workflowResolution = {
        normalizedGoal: 'test goal',
        preset: { id: 'general', requiredMinistries: [] }
      } as any;
      const runtimeStateRepository = {
        load: vi.fn().mockResolvedValue({
          governance: { counselorSelectorConfigs: [config] }
        })
      } as any;

      const result = await applyLifecycleCounselorSelectorGovernance({
        dto,
        workflowResolution,
        runtimeStateRepository
      });

      // Should keep original counselorSelector since config is disabled
      expect(result.counselorSelector).toEqual({});
    });

    it('merges governance capability attachments with existing ones', async () => {
      const dto = {
        goal: 'test',
        constraints: [],
        capabilityAttachments: [{ id: 'existing-1', displayName: 'Existing' }]
      } as any;
      const workflowResolution = {
        normalizedGoal: 'test goal',
        preset: { id: 'general', requiredMinistries: [] }
      } as any;
      const runtimeStateRepository = {
        load: vi.fn().mockResolvedValue({ governance: {} })
      } as any;

      const result = await applyLifecycleCounselorSelectorGovernance({
        dto,
        workflowResolution,
        runtimeStateRepository
      });

      expect(result.capabilityAttachments).toBeDefined();
      expect(result.capabilityAttachments.some((a: any) => a.id === 'existing-1')).toBe(true);
    });
  });
});
