import { describe, expect, it, vi } from 'vitest';

import { confirmSelectedLearningCandidates } from '../../../../src/flows/learning/nodes/learning-candidate-confirmation';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    learningCandidates: [],
    learningEvaluation: undefined,
    ...overrides
  };
}

function makeDependencies(overrides: Record<string, unknown> = {}) {
  return {
    memoryRepository: {
      search: vi.fn().mockResolvedValue([]),
      append: vi.fn().mockResolvedValue(undefined),
      ...overrides.memoryRepository
    },
    ruleRepository: {
      append: vi.fn().mockResolvedValue(undefined),
      ...overrides.ruleRepository
    },
    skillRegistry: {
      publishToLab: vi.fn().mockResolvedValue(undefined),
      ...overrides.skillRegistry
    }
  };
}

describe('confirmSelectedLearningCandidates', () => {
  it('returns empty when task has no candidates', async () => {
    const task = makeTask({ learningCandidates: [] });
    const deps = makeDependencies();
    const result = await confirmSelectedLearningCandidates(task, undefined, deps);
    expect(result).toEqual([]);
  });

  it('returns empty when learningCandidates is undefined', async () => {
    const task = makeTask({ learningCandidates: undefined });
    const deps = makeDependencies();
    const result = await confirmSelectedLearningCandidates(task, undefined, deps);
    expect(result).toEqual([]);
  });

  it('confirms all candidates when candidateIds is undefined', async () => {
    const task = makeTask({
      learningCandidates: [
        { id: 'c1', type: 'rule', payload: { rule: 'test' }, status: 'pending' },
        { id: 'c2', type: 'skill', payload: { card: 'test' }, status: 'pending' }
      ]
    });
    const deps = makeDependencies();
    const result = await confirmSelectedLearningCandidates(task, undefined, deps);

    expect(result).toEqual(expect.arrayContaining(['c1', 'c2']));
    expect(result).toHaveLength(2);
  });

  it('confirms only selected candidates when candidateIds provided', async () => {
    const task = makeTask({
      learningCandidates: [
        { id: 'c1', type: 'rule', payload: { rule: 'test' }, status: 'pending' },
        { id: 'c2', type: 'skill', payload: { card: 'test' }, status: 'pending' }
      ]
    });
    const deps = makeDependencies();
    const result = await confirmSelectedLearningCandidates(task, ['c1'], deps);

    expect(result).toEqual(['c1']);
    expect(deps.ruleRepository.append).toHaveBeenCalledTimes(1);
    expect(deps.skillRegistry.publishToLab).not.toHaveBeenCalled();
  });

  it('appends rule candidates to rule repository', async () => {
    const rulePayload = { pattern: 'test pattern', action: 'test' };
    const task = makeTask({
      learningCandidates: [{ id: 'rule-1', type: 'rule', payload: rulePayload, status: 'pending' }]
    });
    const deps = makeDependencies();
    await confirmSelectedLearningCandidates(task, undefined, deps);

    expect(deps.ruleRepository.append).toHaveBeenCalledWith(rulePayload);
  });

  it('publishes skill candidates to lab', async () => {
    const skillPayload = { id: 'skill-1', name: 'test skill' };
    const task = makeTask({
      learningCandidates: [{ id: 'sk-1', type: 'skill', payload: skillPayload, status: 'pending' }]
    });
    const deps = makeDependencies();
    await confirmSelectedLearningCandidates(task, undefined, deps);

    expect(deps.skillRegistry.publishToLab).toHaveBeenCalledWith(skillPayload);
  });

  it('marks selected candidates as confirmed', async () => {
    const task = makeTask({
      learningCandidates: [{ id: 'c1', type: 'rule', payload: { rule: 'test' }, status: 'pending' }]
    });
    const deps = makeDependencies();
    await confirmSelectedLearningCandidates(task, undefined, deps);

    expect(task.learningCandidates[0].status).toBe('confirmed');
    expect(task.learningCandidates[0].confirmedAt).toBeDefined();
  });

  it('leaves unselected candidates as-is', async () => {
    const task = makeTask({
      learningCandidates: [
        { id: 'c1', type: 'rule', payload: { rule: 'test' }, status: 'pending' },
        { id: 'c2', type: 'skill', payload: {}, status: 'pending' }
      ]
    });
    const deps = makeDependencies();
    await confirmSelectedLearningCandidates(task, ['c1'], deps);

    expect(task.learningCandidates[0].status).toBe('confirmed');
    expect(task.learningCandidates[1].status).toBe('pending');
  });

  describe('memory candidate with conflicts', () => {
    it('skips memory when existing record has higher effectiveness', async () => {
      const existingRecord = {
        id: 'existing-1',
        summary: 'Same summary',
        tags: ['tag1', 'tag2'],
        effectiveness: 0.9
      };
      const task = makeTask({
        learningCandidates: [
          {
            id: 'mem-1',
            type: 'memory',
            payload: { id: 'new-mem', summary: 'Same summary', tags: ['tag1', 'tag2'], effectiveness: 0.5 },
            status: 'pending'
          }
        ]
      });
      const deps = makeDependencies({
        memoryRepository: { search: vi.fn().mockResolvedValue([existingRecord]) }
      });
      await confirmSelectedLearningCandidates(task, undefined, deps);

      expect(deps.memoryRepository.append).not.toHaveBeenCalled();
    });

    it('appends memory when no conflicts exist', async () => {
      const task = makeTask({
        learningCandidates: [
          {
            id: 'mem-1',
            type: 'memory',
            payload: { id: 'new-mem', summary: 'New unique summary', tags: ['unique-tag'], effectiveness: 0.8 },
            status: 'pending'
          }
        ]
      });
      const deps = makeDependencies({
        memoryRepository: { search: vi.fn().mockResolvedValue([]) }
      });
      await confirmSelectedLearningCandidates(task, undefined, deps);

      expect(deps.memoryRepository.append).toHaveBeenCalled();
    });

    it('records conflict in learning evaluation', async () => {
      const existingRecord = {
        id: 'existing-1',
        summary: 'Same summary',
        tags: ['tag1', 'tag2'],
        effectiveness: 0.9
      };
      const task = makeTask({
        learningCandidates: [
          {
            id: 'mem-1',
            type: 'memory',
            payload: { id: 'new-mem', summary: 'Same summary', tags: ['tag1', 'tag2'], effectiveness: 0.5 },
            status: 'pending'
          }
        ]
      });
      const deps = makeDependencies({
        memoryRepository: { search: vi.fn().mockResolvedValue([existingRecord]) }
      });
      await confirmSelectedLearningCandidates(task, undefined, deps);

      expect(task.learningEvaluation).toBeDefined();
      expect(task.learningEvaluation.conflictDetected).toBe(true);
      expect(task.learningEvaluation.conflictTargets).toContain('existing-1');
    });

    it('skips close-effectiveness conflicts without appending', async () => {
      const existingRecord = {
        id: 'existing-1',
        summary: 'Same summary',
        tags: ['tag1', 'tag2'],
        effectiveness: 0.75
      };
      const task = makeTask({
        learningCandidates: [
          {
            id: 'mem-1',
            type: 'memory',
            payload: { id: 'new-mem', summary: 'Same summary', tags: ['tag1', 'tag2'], effectiveness: 0.7 },
            status: 'pending'
          }
        ]
      });
      const deps = makeDependencies({
        memoryRepository: { search: vi.fn().mockResolvedValue([existingRecord]) }
      });
      await confirmSelectedLearningCandidates(task, undefined, deps);

      expect(deps.memoryRepository.append).not.toHaveBeenCalled();
      expect(task.learningEvaluation.governanceWarnings.length).toBeGreaterThan(0);
    });

    it('detects conflict via tag overlap >= 2', async () => {
      const existingRecord = {
        id: 'existing-1',
        summary: 'Different summary entirely',
        tags: ['shared1', 'shared2'],
        effectiveness: 0.3
      };
      const task = makeTask({
        learningCandidates: [
          {
            id: 'mem-1',
            type: 'memory',
            payload: { id: 'new-mem', summary: 'Different summary', tags: ['shared1', 'shared2'], effectiveness: 0.5 },
            status: 'pending'
          }
        ]
      });
      const deps = makeDependencies({
        memoryRepository: { search: vi.fn().mockResolvedValue([existingRecord]) }
      });
      await confirmSelectedLearningCandidates(task, undefined, deps);

      expect(task.learningEvaluation.conflictDetected).toBe(true);
    });

    it('does not detect conflict with single tag overlap', async () => {
      const existingRecord = {
        id: 'existing-1',
        summary: 'Different summary entirely',
        tags: ['shared1'],
        effectiveness: 0.3
      };
      const task = makeTask({
        learningCandidates: [
          {
            id: 'mem-1',
            type: 'memory',
            payload: { id: 'new-mem', summary: 'Different summary', tags: ['shared1'], effectiveness: 0.5 },
            status: 'pending'
          }
        ]
      });
      const deps = makeDependencies({
        memoryRepository: { search: vi.fn().mockResolvedValue([existingRecord]) }
      });
      await confirmSelectedLearningCandidates(task, undefined, deps);

      expect(deps.memoryRepository.append).toHaveBeenCalled();
    });
  });
});
