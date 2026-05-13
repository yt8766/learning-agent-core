import { describe, expect, it } from 'vitest';

import { isDiagnosisTask } from '../src/flows/learning/shared/learning-task-diagnosis';

describe('learning-task-diagnosis', () => {
  describe('isDiagnosisTask', () => {
    it('returns true for diagnosis_for: context', () => {
      expect(isDiagnosisTask({ goal: 'test', context: 'diagnosis_for: task-1' })).toBe(true);
    });

    it('returns true for 请诊断任务 goal', () => {
      expect(isDiagnosisTask({ goal: '请诊断任务 #123', context: '' })).toBe(true);
    });

    it('returns true for agent 错误 goal', () => {
      expect(isDiagnosisTask({ goal: 'agent 错误排查', context: '' })).toBe(true);
    });

    it('returns true for 恢复方案 goal', () => {
      expect(isDiagnosisTask({ goal: '给出恢复方案', context: '' })).toBe(true);
    });

    it('returns true for diagnose task goal', () => {
      expect(isDiagnosisTask({ goal: 'diagnose task failure', context: '' })).toBe(true);
    });

    it('returns false for normal goal', () => {
      expect(isDiagnosisTask({ goal: 'write a blog post', context: 'normal context' })).toBe(false);
    });

    it('handles undefined goal and context', () => {
      expect(isDiagnosisTask({ goal: undefined as any, context: undefined as any })).toBe(false);
    });

    it('is case insensitive', () => {
      expect(isDiagnosisTask({ goal: 'DIAGNOSE TASK', context: '' })).toBe(true);
    });
  });
});
