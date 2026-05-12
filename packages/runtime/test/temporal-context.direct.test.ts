import { describe, expect, it } from 'vitest';

import {
  buildTemporalContextBlock,
  isFreshnessSensitiveGoal,
  buildFreshnessAnswerInstruction
} from '../src/utils/prompts/temporal-context';

describe('temporal-context (direct)', () => {
  describe('buildTemporalContextBlock', () => {
    it('includes absolute date', () => {
      const ref = new Date('2026-05-10T12:00:00Z');
      const block = buildTemporalContextBlock(ref);
      expect(block).toContain('2026-05-10');
    });

    it('includes ISO timestamp', () => {
      const ref = new Date('2026-05-10T12:00:00Z');
      const block = buildTemporalContextBlock(ref);
      expect(block).toContain('2026-05-10T12:00:00.000Z');
    });

    it('includes freshness instructions', () => {
      const block = buildTemporalContextBlock();
      expect(block).toContain('最近');
      expect(block).toContain('今天');
    });

    it('uses current date when no argument', () => {
      const block = buildTemporalContextBlock();
      const year = new Date().getFullYear();
      expect(block).toContain(String(year));
    });
  });

  describe('isFreshnessSensitiveGoal', () => {
    it('detects "latest"', () => {
      expect(isFreshnessSensitiveGoal('what is the latest news')).toBe(true);
    });

    it('detects "today"', () => {
      expect(isFreshnessSensitiveGoal('what happened today')).toBe(true);
    });

    it('detects "yesterday"', () => {
      expect(isFreshnessSensitiveGoal('events from yesterday')).toBe(true);
    });

    it('detects "this week"', () => {
      expect(isFreshnessSensitiveGoal('events this week')).toBe(true);
    });

    it('detects Chinese "最新"', () => {
      expect(isFreshnessSensitiveGoal('最新的新闻')).toBe(true);
    });

    it('detects Chinese "今天"', () => {
      expect(isFreshnessSensitiveGoal('今天发生了什么')).toBe(true);
    });

    it('detects Chinese "昨天"', () => {
      expect(isFreshnessSensitiveGoal('昨天的会议')).toBe(true);
    });

    it('detects Chinese "本周"', () => {
      expect(isFreshnessSensitiveGoal('本周的任务')).toBe(true);
    });

    it('detects Chinese "现在"', () => {
      expect(isFreshnessSensitiveGoal('现在的状态')).toBe(true);
    });

    it('returns false for non-freshness goals', () => {
      expect(isFreshnessSensitiveGoal('how to write a function')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isFreshnessSensitiveGoal('')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isFreshnessSensitiveGoal('LATEST news')).toBe(true);
      expect(isFreshnessSensitiveGoal('TODAY')).toBe(true);
    });
  });

  describe('buildFreshnessAnswerInstruction', () => {
    it('returns empty for non-freshness goal', () => {
      expect(buildFreshnessAnswerInstruction('how to code')).toBe('');
    });

    it('returns instruction for freshness goal', () => {
      const ref = new Date('2026-05-10T12:00:00Z');
      const instruction = buildFreshnessAnswerInstruction('latest news', ref);
      expect(instruction).toContain('2026-05-10');
      expect(instruction).toContain('时效性');
    });

    it('includes absolute date in instruction', () => {
      const ref = new Date('2026-12-25T00:00:00Z');
      const instruction = buildFreshnessAnswerInstruction('today', ref);
      expect(instruction).toContain('2026-12-25');
    });
  });
});
