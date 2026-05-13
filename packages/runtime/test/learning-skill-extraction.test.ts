import { describe, expect, it } from 'vitest';

import { shouldExtractSkillForTask } from '../src/flows/learning/shared/learning-skill-extraction';

describe('learning-skill-extraction', () => {
  describe('shouldExtractSkillForTask', () => {
    it('returns false when evaluation does not request skill extraction', () => {
      expect(shouldExtractSkillForTask({ goal: 'test', context: '', result: '' }, undefined)).toBe(false);
      expect(shouldExtractSkillForTask({ goal: 'test', context: '', result: '' }, { shouldExtractSkill: false })).toBe(
        false
      );
    });

    it('returns true for valid task when evaluation requests extraction', () => {
      expect(
        shouldExtractSkillForTask(
          { goal: 'build a feature', context: 'implement API', result: 'done' },
          { shouldExtractSkill: true }
        )
      ).toBe(true);
    });

    it('returns false for 周报 task', () => {
      expect(
        shouldExtractSkillForTask({ goal: '生成周报', context: '', result: '' }, { shouldExtractSkill: true })
      ).toBe(false);
    });

    it('returns false for 日报 task', () => {
      expect(shouldExtractSkillForTask({ goal: '写日报', context: '', result: '' }, { shouldExtractSkill: true })).toBe(
        false
      );
    });

    it('returns false for 月报 task', () => {
      expect(
        shouldExtractSkillForTask({ goal: '准备月报', context: '', result: '' }, { shouldExtractSkill: true })
      ).toBe(false);
    });

    it('returns false for 年报 task', () => {
      expect(
        shouldExtractSkillForTask({ goal: '生成年报', context: '', result: '' }, { shouldExtractSkill: true })
      ).toBe(false);
    });

    it('returns false for 工作总结 task', () => {
      expect(
        shouldExtractSkillForTask({ goal: '写工作总结', context: '', result: '' }, { shouldExtractSkill: true })
      ).toBe(false);
    });

    it('returns false for 润色 task', () => {
      expect(
        shouldExtractSkillForTask({ goal: '润色一下', context: '', result: '' }, { shouldExtractSkill: true })
      ).toBe(false);
    });

    it('returns false for 翻译 task', () => {
      expect(
        shouldExtractSkillForTask({ goal: '翻译这段话', context: '', result: '' }, { shouldExtractSkill: true })
      ).toBe(false);
    });

    it('returns false for 邮件 task', () => {
      expect(
        shouldExtractSkillForTask({ goal: '写一封邮件', context: '', result: '' }, { shouldExtractSkill: true })
      ).toBe(false);
    });

    it('returns false for 文案 task', () => {
      expect(shouldExtractSkillForTask({ goal: '写文案', context: '', result: '' }, { shouldExtractSkill: true })).toBe(
        false
      );
    });

    it('returns false for 汇报 task', () => {
      expect(
        shouldExtractSkillForTask({ goal: '准备汇报', context: '', result: '' }, { shouldExtractSkill: true })
      ).toBe(false);
    });

    it('detects blocked pattern in context', () => {
      expect(
        shouldExtractSkillForTask(
          { goal: 'test', context: '生成周报 for this week', result: '' },
          { shouldExtractSkill: true }
        )
      ).toBe(false);
    });

    it('detects blocked pattern in result', () => {
      expect(
        shouldExtractSkillForTask({ goal: 'test', context: '', result: '草稿已经完成' }, { shouldExtractSkill: true })
      ).toBe(false);
    });

    it('handles undefined context and result', () => {
      expect(shouldExtractSkillForTask({ goal: 'build feature' } as any, { shouldExtractSkill: true })).toBe(true);
    });
  });
});
