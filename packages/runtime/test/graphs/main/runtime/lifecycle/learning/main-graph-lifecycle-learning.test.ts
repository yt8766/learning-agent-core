import { describe, expect, it, vi } from 'vitest';

vi.mock('@agent/core', async () => {
  const actual = await vi.importActual<any>('@agent/core');
  return {
    ...actual,
    LearningConflictScanResultSchema: {
      safeParse: vi.fn().mockImplementation((data: any) => {
        if (data && data.conflictPairs) {
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
    specialistLead: { domain: 'general', displayName: 'General' },
    supportingSpecialists: []
  }),
  resolveWorkflowPreset: vi.fn().mockReturnValue({
    normalizedGoal: 'test goal',
    preset: { id: 'general', displayName: 'General', requiredMinistries: [] }
  })
}));

vi.mock('../../../../../../src/governance/runtime-governance-store', () => ({
  getGovernanceProfiles: vi.fn().mockReturnValue([]),
  getCapabilityGovernanceProfiles: vi.fn().mockReturnValue([])
}));

import {
  scanLifecycleLearningConflicts,
  updateLifecycleLearningConflictStatus,
  listLifecycleRules,
  createLifecycleDocumentLearningJob,
  createLifecycleResearchLearningJob,
  getLifecycleLearningJob,
  listLifecycleLearningJobs
} from '../../../../../../src/graphs/main/runtime/lifecycle/learning/main-graph-lifecycle-learning';

describe('main-graph-lifecycle-learning', () => {
  describe('scanLifecycleLearningConflicts', () => {
    it('returns empty conflict pairs when no active memories', async () => {
      const deps = {
        memoryRepository: { list: vi.fn().mockResolvedValue([]) },
        runtimeStateRepository: {
          load: vi.fn().mockResolvedValue({ governance: {} }),
          save: vi.fn().mockResolvedValue(undefined)
        }
      } as any;

      const result = await scanLifecycleLearningConflicts(deps);
      expect(result.conflictPairs).toEqual([]);
    });

    it('detects conflict pairs from memories with same conflictSetId', async () => {
      const memories = [
        { id: 'm1', conflictSetId: 'set-1', effectiveness: 0.9, contextSignature: 'sig1' },
        { id: 'm2', conflictSetId: 'set-1', effectiveness: 0.5, contextSignature: 'sig1' }
      ];
      const deps = {
        memoryRepository: { list: vi.fn().mockResolvedValue(memories) },
        runtimeStateRepository: {
          load: vi.fn().mockResolvedValue({ governance: {} }),
          save: vi.fn().mockResolvedValue(undefined)
        }
      } as any;

      const result = await scanLifecycleLearningConflicts(deps);
      expect(result.conflictPairs).toHaveLength(1);
      expect(result.conflictPairs[0].memoryIds).toContain('m1');
      expect(result.conflictPairs[0].memoryIds).toContain('m2');
    });

    it('assigns auto_preferred resolution when spread >= 0.2', async () => {
      const memories = [
        { id: 'm1', conflictSetId: 'set-1', effectiveness: 0.9, contextSignature: 'sig1' },
        { id: 'm2', conflictSetId: 'set-1', effectiveness: 0.5, contextSignature: 'sig1' }
      ];
      const deps = {
        memoryRepository: { list: vi.fn().mockResolvedValue(memories) },
        runtimeStateRepository: {
          load: vi.fn().mockResolvedValue({ governance: {} }),
          save: vi.fn().mockResolvedValue(undefined)
        }
      } as any;

      const result = await scanLifecycleLearningConflicts(deps);
      expect(result.conflictPairs[0].resolution).toBe('auto_preferred');
      expect(result.conflictPairs[0].preferredMemoryId).toBe('m1');
    });

    it('skips quarantined and invalidated memories', async () => {
      const memories = [
        { id: 'm1', conflictSetId: 'set-1', quarantined: true, effectiveness: 0.9 },
        { id: 'm2', conflictSetId: 'set-1', status: 'invalidated', effectiveness: 0.5 },
        { id: 'm3', conflictSetId: 'set-1', status: 'superseded', effectiveness: 0.3 },
        { id: 'm4', conflictSetId: 'set-1', status: 'retired', effectiveness: 0.2 }
      ];
      const deps = {
        memoryRepository: { list: vi.fn().mockResolvedValue(memories) },
        runtimeStateRepository: {
          load: vi.fn().mockResolvedValue({ governance: {} }),
          save: vi.fn().mockResolvedValue(undefined)
        }
      } as any;

      const result = await scanLifecycleLearningConflicts(deps);
      expect(result.conflictPairs).toHaveLength(0);
    });

    it('uses contextSignature as key when conflictSetId is missing', async () => {
      const memories = [
        { id: 'm1', contextSignature: 'sig-1', effectiveness: 0.8 },
        { id: 'm2', contextSignature: 'sig-1', effectiveness: 0.6 }
      ];
      const deps = {
        memoryRepository: { list: vi.fn().mockResolvedValue(memories) },
        runtimeStateRepository: {
          load: vi.fn().mockResolvedValue({ governance: {} }),
          save: vi.fn().mockResolvedValue(undefined)
        }
      } as any;

      const result = await scanLifecycleLearningConflicts(deps);
      expect(result.conflictPairs).toHaveLength(1);
    });

    it('skips memories without conflictSetId or contextSignature', async () => {
      const memories = [
        { id: 'm1', effectiveness: 0.8 },
        { id: 'm2', effectiveness: 0.6 }
      ];
      const deps = {
        memoryRepository: { list: vi.fn().mockResolvedValue(memories) },
        runtimeStateRepository: {
          load: vi.fn().mockResolvedValue({ governance: {} }),
          save: vi.fn().mockResolvedValue(undefined)
        }
      } as any;

      const result = await scanLifecycleLearningConflicts(deps);
      expect(result.conflictPairs).toHaveLength(0);
    });
  });

  describe('updateLifecycleLearningConflictStatus', () => {
    it('returns undefined when no existing scan data', async () => {
      const deps = {
        runtimeStateRepository: {
          load: vi.fn().mockResolvedValue({ governance: {} }),
          save: vi.fn().mockResolvedValue(undefined)
        }
      } as any;

      const result = await updateLifecycleLearningConflictStatus(deps, 'conflict:1', 'resolved');
      expect(result).toBeUndefined();
    });

    it('updates conflict status when found', async () => {
      const scanData = {
        conflictPairs: [{ id: 'conflict:1', status: 'open', memoryIds: ['m1', 'm2'], preferredMemoryId: 'm1' }],
        manualReviewQueue: [{ id: 'conflict:1', status: 'open', memoryIds: ['m1', 'm2'] }]
      };
      const deps = {
        runtimeStateRepository: {
          load: vi.fn().mockResolvedValue({ governance: { learningConflictScan: scanData } }),
          save: vi.fn().mockResolvedValue(undefined)
        }
      } as any;

      const result = await updateLifecycleLearningConflictStatus(deps, 'conflict:1', 'resolved', 'm2');
      expect(result).toBeDefined();
      expect(result.status).toBe('resolved');
      expect(result.preferredMemoryId).toBe('m2');
    });

    it('adds to manual review queue when status is open', async () => {
      const scanData = {
        conflictPairs: [{ id: 'conflict:1', status: 'open', memoryIds: ['m1', 'm2'] }],
        manualReviewQueue: []
      };
      const deps = {
        runtimeStateRepository: {
          load: vi.fn().mockResolvedValue({ governance: { learningConflictScan: scanData } }),
          save: vi.fn().mockResolvedValue(undefined)
        }
      } as any;

      await updateLifecycleLearningConflictStatus(deps, 'conflict:1', 'open');
      expect(deps.runtimeStateRepository.save).toHaveBeenCalled();
    });
  });

  describe('listLifecycleRules', () => {
    it('delegates to ruleRepository.list', async () => {
      const rules = [{ id: 'rule-1', name: 'test' }];
      const deps = { ruleRepository: { list: vi.fn().mockResolvedValue(rules) } } as any;
      const result = await listLifecycleRules(deps);
      expect(result).toEqual(rules);
    });
  });

  describe('createLifecycleDocumentLearningJob', () => {
    it('delegates to learningJobsRuntime.createDocumentLearningJob', async () => {
      const job = { id: 'learn-1', sourceType: 'document' };
      const deps = { learningJobsRuntime: { createDocumentLearningJob: vi.fn().mockResolvedValue(job) } } as any;
      const result = await createLifecycleDocumentLearningJob(deps, { documentUri: 'test.pdf' } as any);
      expect(result).toEqual(job);
    });
  });

  describe('createLifecycleResearchLearningJob', () => {
    it('delegates to learningJobsRuntime.createResearchLearningJob', async () => {
      const job = { id: 'learn-2', sourceType: 'research' };
      const deps = { learningJobsRuntime: { createResearchLearningJob: vi.fn().mockResolvedValue(job) } } as any;
      const result = await createLifecycleResearchLearningJob(deps, { goal: 'research' } as any);
      expect(result).toEqual(job);
    });
  });

  describe('getLifecycleLearningJob', () => {
    it('delegates to learningJobsRuntime.getLearningJob', () => {
      const job = { id: 'learn-1' };
      const deps = { learningJobsRuntime: { getLearningJob: vi.fn().mockReturnValue(job) } } as any;
      expect(getLifecycleLearningJob(deps, 'learn-1')).toEqual(job);
    });
  });

  describe('listLifecycleLearningJobs', () => {
    it('delegates to learningJobsRuntime.listLearningJobs', () => {
      const jobs = [{ id: 'learn-1' }];
      const deps = { learningJobsRuntime: { listLearningJobs: vi.fn().mockReturnValue(jobs) } } as any;
      expect(listLifecycleLearningJobs(deps)).toEqual(jobs);
    });
  });
});
