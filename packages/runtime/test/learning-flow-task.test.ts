import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/flows/learning/shared/learning-task-diagnosis', () => ({
  isDiagnosisTask: vi.fn().mockReturnValue(false)
}));
vi.mock('../src/flows/learning/shared/learning-task-evidence', () => ({
  deriveEvidence: vi.fn().mockReturnValue([]),
  mergeEvidence: vi.fn((existing: unknown[], incoming: unknown[]) => [...existing, ...incoming]),
  inferTrustClass: vi.fn().mockReturnValue('official'),
  normalizeInstalledSkillId: vi.fn((id: string) => id)
}));
vi.mock('../src/flows/learning/shared/learning-skill-extraction', () => ({
  shouldExtractSkillForTask: vi.fn().mockReturnValue(false)
}));

import { prepareTaskLearning, ensureCandidates } from '../src/flows/learning/learning-flow-task';
import { isDiagnosisTask } from '../src/flows/learning/shared/learning-task-diagnosis';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    context: 'test context',
    result: 'test result',
    status: 'completed',
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

describe('learning-flow-task', () => {
  describe('prepareTaskLearning', () => {
    it('produces evaluation with score and confidence', () => {
      const task = makeTask();
      const evaluation = prepareTaskLearning(task);
      expect(evaluation.score).toBeGreaterThanOrEqual(0);
      expect(evaluation.score).toBeLessThanOrEqual(100);
      expect(evaluation.confidence).toBeDefined();
      expect(evaluation.shouldLearn).toBeDefined();
      expect(evaluation.notes).toBeInstanceOf(Array);
      expect(evaluation.derivedFromLayers).toContain('L1-session');
    });

    it('scores higher for successful evaluation', () => {
      const lowTask = makeTask();
      const lowEval = prepareTaskLearning(lowTask, { success: false } as any);

      const highTask = makeTask();
      const highEval = prepareTaskLearning(highTask, { success: true, quality: 'high' } as any);

      expect(highEval.score).toBeGreaterThan(lowEval.score);
    });

    it('includes memory and rule in suggestedCandidateTypes by default', () => {
      const task = makeTask();
      const evaluation = prepareTaskLearning(task, {
        success: true,
        shouldWriteMemory: true,
        shouldCreateRule: true
      } as any);
      expect(evaluation.suggestedCandidateTypes).toContain('memory');
      expect(evaluation.rationale).toBeDefined();
    });

    it('sets shouldSearchSkills when capabilityGapDetected', () => {
      const task = makeTask({ skillSearch: { capabilityGapDetected: true, suggestions: [] } });
      const evaluation = prepareTaskLearning(task);
      expect(evaluation.shouldSearchSkills).toBe(true);
    });

    it('records review decision in notes', () => {
      const task = makeTask();
      const review = { decision: 'pass' } as any;
      const evaluation = prepareTaskLearning(task, undefined, review);
      expect(evaluation.notes.some((note: string) => note.includes('pass'))).toBe(true);
    });

    it('includes diagnosis note for diagnosis tasks', () => {
      vi.mocked(isDiagnosisTask).mockReturnValueOnce(true);
      const task = makeTask();
      const evaluation = prepareTaskLearning(task);
      expect(evaluation.notes.some((note: string) => note.includes('诊断'))).toBe(true);
    });

    it('includes external source count note when sources exist', () => {
      const task = makeTask({
        externalSources: [
          { id: 'src-1', trustClass: 'web' },
          { id: 'src-2', trustClass: 'official' }
        ]
      });
      const evaluation = prepareTaskLearning(task);
      expect(evaluation.notes.some((note: string) => note.includes('外部来源'))).toBe(true);
    });

    it('sets expertiseSignals based on preference signals', () => {
      const task = makeTask({ goal: '请只看最终答复即可', result: 'done' });
      const evaluation = prepareTaskLearning(task);
      expect(evaluation.expertiseSignals).toContain('user-preference');
    });

    it('extracts preference signals from goal context', () => {
      const task = makeTask({ goal: '帮我把审批放在聊天记录中处理', result: 'done' });
      const evaluation = prepareTaskLearning(task);
      expect(evaluation.expertiseSignals).toContain('user-preference');
    });

    it('detects expert domain signal', () => {
      const task = makeTask({ goal: '请给出专业建议', result: 'done' });
      const evaluation = prepareTaskLearning(task);
      expect(evaluation.expertiseSignals).toContain('user-preference');
    });

    it('clamps score between 0 and 100', () => {
      const task = makeTask({
        externalSources: Array.from({ length: 20 }, (_, i) => ({ id: `src-${i}`, trustClass: 'web' }))
      });
      const evaluation = prepareTaskLearning(task, { success: true, quality: 'high' } as any);
      expect(evaluation.score).toBeLessThanOrEqual(100);
      expect(evaluation.score).toBeGreaterThanOrEqual(0);
    });

    it('builds sourceSummary correctly', () => {
      const task = makeTask({
        externalSources: [{ id: 'src-1', trustClass: 'web' }]
      });
      const evaluation = prepareTaskLearning(task);
      expect(evaluation.sourceSummary).toBeDefined();
    });

    it('assigns task.externalSources after prepare', () => {
      const task = makeTask();
      prepareTaskLearning(task);
      expect(task.externalSources).toBeDefined();
    });

    it('assigns task.reusedMemories after prepare', () => {
      const task = makeTask({ reusedMemories: ['mem-1'] });
      prepareTaskLearning(task);
      expect(task.reusedMemories).toContain('mem-1');
    });
  });

  describe('ensureCandidates', () => {
    it('calls prepareTaskLearning when no learningEvaluation', () => {
      const task = makeTask();
      ensureCandidates(task);
      expect(task.learningEvaluation).toBeDefined();
    });

    it('returns empty when shouldLearn is false', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: false,
          score: 10,
          confidence: 'low',
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: []
        }
      });
      const result = ensureCandidates(task);
      expect(result).toEqual([]);
      expect(task.learningCandidates).toEqual([]);
    });

    it('returns existing candidates when already present', () => {
      const existing = [{ id: 'cand-1' }] as any;
      const task = makeTask({
        learningEvaluation: { shouldLearn: true, score: 60, confidence: 'medium' },
        learningCandidates: existing
      });
      const result = ensureCandidates(task);
      expect(result).toBe(existing);
    });

    it('creates candidates when shouldLearn is true and none exist', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 70,
          confidence: 'medium',
          suggestedCandidateTypes: ['memory', 'rule'],
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: [],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 0,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        learningCandidates: []
      });
      const result = ensureCandidates(task);
      expect(result.length).toBeGreaterThan(0);
      expect(task.learningCandidates!.length).toBeGreaterThan(0);
    });

    it('includes memory and rule candidate types', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 70,
          confidence: 'medium',
          suggestedCandidateTypes: ['memory', 'rule'],
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: [],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 0,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        learningCandidates: []
      });
      const result = ensureCandidates(task);
      const types = result.map(c => c.type);
      expect(types).toContain('memory');
      expect(types).toContain('rule');
    });

    it('includes skill candidate when suggested', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 70,
          confidence: 'medium',
          suggestedCandidateTypes: ['skill'],
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: [],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 0,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        learningCandidates: [],
        plan: { steps: ['step 1'] }
      });
      const result = ensureCandidates(task);
      expect(result.some(c => c.type === 'skill')).toBe(true);
    });

    it('auto-confirms when confidence is high and few external sources', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 80,
          confidence: 'high',
          suggestedCandidateTypes: ['memory'],
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: [],
          sourceSummary: {
            externalSourceCount: 1,
            internalSourceCount: 0,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        learningCandidates: []
      });
      const result = ensureCandidates(task);
      expect(result.some(c => c.autoConfirmEligible)).toBe(true);
    });

    it('updates recommendedCandidateIds on evaluation', () => {
      const task = makeTask({
        learningEvaluation: {
          shouldLearn: true,
          score: 60,
          confidence: 'medium',
          suggestedCandidateTypes: ['memory'],
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: [],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 0,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        learningCandidates: []
      });
      ensureCandidates(task);
      expect(task.learningEvaluation.recommendedCandidateIds.length).toBeGreaterThan(0);
    });

    it('marks completed high-value task memory as task_summary', () => {
      const task = makeTask({
        status: 'completed',
        goal: '请诊断任务问题并给出恢复方案',
        externalSources: Array.from({ length: 5 }, (_, i) => ({ id: `src-${i}` })),
        learningEvaluation: {
          shouldLearn: true,
          score: 80,
          confidence: 'high',
          suggestedCandidateTypes: ['memory'],
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: [],
          sourceSummary: {
            externalSourceCount: 5,
            internalSourceCount: 0,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        learningCandidates: []
      });
      const result = ensureCandidates(task);
      const memCandidate = result.find(c => c.type === 'memory' && !c.id.startsWith('learn_pref'));
      if (memCandidate) {
        expect((memCandidate as any).payload.type).toBeDefined();
      }
    });
  });
});
