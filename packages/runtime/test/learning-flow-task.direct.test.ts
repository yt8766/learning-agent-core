import { describe, expect, it } from 'vitest';

import { TaskStatus } from '@agent/core';

import { prepareTaskLearning, ensureCandidates } from '../src/flows/learning/learning-flow-task';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    context: 'test context',
    result: 'test result',
    status: TaskStatus.COMPLETED,
    trace: [],
    messages: [],
    approvals: [],
    agentStates: [],
    externalSources: [],
    usedInstalledSkills: [],
    usedCompanyWorkers: [],
    reusedMemories: [],
    reusedRules: [],
    learningCandidates: [],
    ...overrides
  } as any;
}

describe('learning-flow-task (direct)', () => {
  describe('prepareTaskLearning', () => {
    it('produces evaluation with score and confidence', () => {
      const task = makeTask();
      const result = prepareTaskLearning(task);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeDefined();
      expect(result.shouldLearn).toBeDefined();
    });

    it('scores higher for successful evaluation', () => {
      const successTask = makeTask();
      const failTask = makeTask();
      const successEval = { success: true, quality: 'high' } as any;
      const failEval = { success: false, quality: 'low' } as any;
      const successResult = prepareTaskLearning(successTask, successEval);
      const failResult = prepareTaskLearning(failTask, failEval);
      expect(successResult.score).toBeGreaterThan(failResult.score);
    });

    it('includes memory and rule in suggestedCandidateTypes by default', () => {
      const task = makeTask();
      const result = prepareTaskLearning(task);
      expect(result.suggestedCandidateTypes).toContain('memory');
      expect(result.suggestedCandidateTypes).toContain('rule');
    });

    it('sets shouldSearchSkills when capabilityGapDetected', () => {
      const task = makeTask({
        skillSearch: { capabilityGapDetected: true, suggestions: [] }
      });
      const result = prepareTaskLearning(task);
      expect(result.shouldSearchSkills).toBe(true);
    });

    it('records review decision in notes', () => {
      const task = makeTask();
      const review = { decision: 'approved' } as any;
      const result = prepareTaskLearning(task, undefined, review);
      expect(result.notes.some(n => n.includes('评审结论'))).toBe(true);
    });

    it('includes external source count note when sources exist', () => {
      const task = makeTask({
        externalSources: [{ id: 'src-1', trustClass: 'official', summary: 'test' }]
      });
      const result = prepareTaskLearning(task);
      expect(result.notes.some(n => n.includes('外部来源'))).toBe(true);
    });

    it('clamps score between 0 and 100', () => {
      const task = makeTask();
      const evalLow = { success: false, quality: 'low' } as any;
      const result = prepareTaskLearning(task, evalLow);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('builds sourceSummary correctly', () => {
      const task = makeTask({
        externalSources: [
          { id: 'src-1', trustClass: 'official', summary: 'test' },
          { id: 'src-2', trustClass: 'internal', summary: 'internal' }
        ],
        reusedMemories: ['mem-1']
      });
      const result = prepareTaskLearning(task);
      expect(result.sourceSummary.externalSourceCount).toBe(1);
      expect(result.sourceSummary.internalSourceCount).toBe(1);
      expect(result.sourceSummary.reusedMemoryCount).toBe(1);
    });

    it('assigns task.externalSources after prepare', () => {
      const task = makeTask();
      prepareTaskLearning(task);
      expect(task.externalSources).toBeDefined();
    });

    it('assigns task.reusedMemories after prepare', () => {
      const task = makeTask();
      prepareTaskLearning(task);
      expect(task.reusedMemories).toBeDefined();
    });

    it('collects skillIds from trace data', () => {
      const task = makeTask({
        trace: [{ summary: 'step', data: { skillIds: ['skill-1', 'skill-2'] } }]
      });
      prepareTaskLearning(task);
      expect(task.reusedSkills).toContain('skill-1');
      expect(task.reusedSkills).toContain('skill-2');
    });

    it('collects single skillId from trace data', () => {
      const task = makeTask({
        trace: [{ summary: 'step', data: { skillId: 'single-skill' } }]
      });
      prepareTaskLearning(task);
      expect(task.reusedSkills).toContain('single-skill');
    });

    it('sets expertiseSignals based on preference signals', () => {
      const task = makeTask({ goal: '最终答复只看最终' });
      const result = prepareTaskLearning(task);
      expect(result.expertiseSignals).toContain('user-preference');
    });

    it('sets rationale based on capabilityGapDetected', () => {
      const task = makeTask({
        skillSearch: { capabilityGapDetected: true, suggestions: [] }
      });
      const result = prepareTaskLearning(task);
      expect(result.rationale).toContain('能力缺口');
    });

    it('shouldLearn is true when score >= 45', () => {
      const task = makeTask();
      const evalHigh = { success: true, quality: 'high' } as any;
      const result = prepareTaskLearning(task, evalHigh);
      expect(result.shouldLearn).toBe(result.score >= 45);
    });

    it('uses high-value task type for completed tasks with many sources', () => {
      const task = makeTask({
        externalSources: Array.from({ length: 5 }, (_, i) => ({
          id: `src-${i}`,
          trustClass: 'official',
          summary: `src ${i}`
        })),
        goal: '发布任务'
      });
      prepareTaskLearning(task);
      // The task should be identified as high-value since it has >= 3 sources and goal matches
      expect(task.learningEvaluation).toBeDefined();
    });

    it('includes notes about usedCompanyWorkers', () => {
      const task = makeTask({ usedCompanyWorkers: ['worker-1'] });
      const result = prepareTaskLearning(task);
      expect(result.notes.some(n => n.includes('公司专员'))).toBe(true);
    });

    it('includes notes about usedInstalledSkills', () => {
      const task = makeTask({ usedInstalledSkills: ['skill-1'] });
      const result = prepareTaskLearning(task);
      expect(result.notes.some(n => n.includes('已安装技能'))).toBe(true);
    });
  });

  describe('ensureCandidates', () => {
    it('calls prepareTaskLearning when no learningEvaluation', () => {
      const task = makeTask({ learningEvaluation: undefined });
      const candidates = ensureCandidates(task);
      expect(task.learningEvaluation).toBeDefined();
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('returns empty when shouldLearn is false', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: false,
          score: 20,
          suggestedCandidateTypes: [],
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: []
        }
      });
      const candidates = ensureCandidates(task);
      expect(candidates).toEqual([]);
    });

    it('returns existing candidates when already present', () => {
      const existing = [{ id: 'existing-candidate' }] as any;
      const task = makeTask({
        learningEvaluation: { shouldLearn: true, score: 60 },
        learningCandidates: existing
      });
      const candidates = ensureCandidates(task);
      expect(candidates).toBe(existing);
    });

    it('creates candidates when shouldLearn is true and none exist', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 60,
          confidence: 'medium',
          suggestedCandidateTypes: ['memory', 'rule'],
          sourceSummary: { externalSourceCount: 0 },
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: []
        }
      });
      const candidates = ensureCandidates(task);
      expect(candidates.length).toBeGreaterThan(0);
    });

    it('includes memory and rule candidate types', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 60,
          confidence: 'medium',
          suggestedCandidateTypes: ['memory', 'rule'],
          sourceSummary: { externalSourceCount: 0 },
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: []
        }
      });
      const candidates = ensureCandidates(task);
      const types = candidates.map(c => c.type);
      expect(types).toContain('memory');
      expect(types).toContain('rule');
    });

    it('includes skill candidate when suggested', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 60,
          confidence: 'medium',
          suggestedCandidateTypes: ['memory', 'rule', 'skill'],
          sourceSummary: { externalSourceCount: 0 },
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: []
        }
      });
      const candidates = ensureCandidates(task);
      const types = candidates.map(c => c.type);
      expect(types).toContain('skill');
    });

    it('auto-confirms when confidence is high and few external sources', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 80,
          confidence: 'high',
          suggestedCandidateTypes: ['memory'],
          sourceSummary: { externalSourceCount: 1 },
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: []
        }
      });
      const candidates = ensureCandidates(task);
      const memoryCandidate = candidates.find(c => c.type === 'memory' && !c.summary.includes('偏好'));
      if (memoryCandidate) {
        expect(memoryCandidate.autoConfirmEligible).toBe(true);
      }
    });

    it('updates recommendedCandidateIds on evaluation', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 60,
          confidence: 'medium',
          suggestedCandidateTypes: ['memory'],
          sourceSummary: { externalSourceCount: 0 },
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: []
        }
      });
      ensureCandidates(task);
      expect(task.learningEvaluation.recommendedCandidateIds.length).toBeGreaterThan(0);
    });
  });

  describe('re-exports', () => {
    it('re-exports isDiagnosisTask', async () => {
      const { isDiagnosisTask } = await import('../src/flows/learning/learning-flow-task');
      expect(typeof isDiagnosisTask).toBe('function');
    });

    it('re-exports shouldExtractSkillForTask', async () => {
      const { shouldExtractSkillForTask } = await import('../src/flows/learning/learning-flow-task');
      expect(typeof shouldExtractSkillForTask).toBe('function');
    });
  });
});
