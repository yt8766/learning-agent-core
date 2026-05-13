import { describe, expect, it } from 'vitest';

import { buildContextCompressionResult, applyReactiveCompactRetry } from '../src/utils/context-compression-pipeline';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    goal: 'test goal',
    context: 'test context',
    planDraft: undefined,
    plan: undefined,
    trace: [],
    ...overrides
  } as any;
}

describe('context-compression-pipeline (direct)', () => {
  describe('buildContextCompressionResult', () => {
    it('builds result from task goal and context', () => {
      const result = buildContextCompressionResult(makeTask());
      expect(result.summary).toContain('test goal');
      expect(result.compressionSource).toBe('heuristic');
      expect(result.reactiveRetryCount).toBe(0);
    });

    it('detects artifact when text contains error keywords', () => {
      const result = buildContextCompressionResult(
        makeTask({
          goal: 'Analyze the error stack trace'
        })
      );
      expect(result.artifactCount).toBe(1);
      expect(result.compressionApplied).toBe(true);
    });

    it('applies micro compression when text exceeds 240 chars', () => {
      const longGoal = 'A'.repeat(300);
      const result = buildContextCompressionResult(makeTask({ goal: longGoal }));
      expect(result.compactedCharacterCount).toBeLessThanOrEqual(240);
      expect(result.compressionApplied).toBe(true);
    });

    it('records traceOverflow in pipeline audit', () => {
      const trace = Array.from({ length: 15 }, (_, i) => ({ id: `trace-${i}` }));
      const result = buildContextCompressionResult(makeTask({ trace }));
      expect(result.compressedMessageCount).toBe(12);
    });

    it('builds pipelineAudit with all stages', () => {
      const result = buildContextCompressionResult(makeTask());
      expect(result.pipelineAudit).toBeDefined();
      expect(result.pipelineAudit.length).toBeGreaterThanOrEqual(4);
      expect(result.pipelineAudit.some(a => a.stage === 'large_result_offload')).toBe(true);
      expect(result.pipelineAudit.some(a => a.stage === 'micro_compression')).toBe(true);
      expect(result.pipelineAudit.some(a => a.stage === 'history_trim')).toBe(true);
      expect(result.pipelineAudit.some(a => a.stage === 'projection')).toBe(true);
      expect(result.pipelineAudit.some(a => a.stage === 'conversation_summary')).toBe(true);
    });

    it('includes planDraft and plan summaries in raw segments', () => {
      const result = buildContextCompressionResult(
        makeTask({
          planDraft: { summary: 'plan draft summary' },
          plan: { summary: 'plan summary' }
        })
      );
      expect(result.summary).toContain('plan draft summary');
    });

    it('handles empty segments gracefully', () => {
      const result = buildContextCompressionResult(
        makeTask({
          goal: '',
          context: undefined
        })
      );
      expect(result.summary).toBeDefined();
    });

    it('sets originalCharacterCount', () => {
      const result = buildContextCompressionResult(makeTask({ goal: 'short' }));
      expect(result.originalCharacterCount).toBeGreaterThan(0);
    });
  });

  describe('applyReactiveCompactRetry', () => {
    it('truncates long summary to 180 chars', () => {
      const base = buildContextCompressionResult(makeTask({ goal: 'A'.repeat(300) }));
      const result = applyReactiveCompactRetry(base, 'test-trigger', 'fallback');
      expect(result.compactedCharacterCount).toBeLessThanOrEqual(180);
      expect(result.reactiveRetryCount).toBe(1);
    });

    it('uses fallback summary when result summary is empty', () => {
      const base = { ...buildContextCompressionResult(makeTask()), summary: '' };
      const result = applyReactiveCompactRetry(base, 'test-trigger', 'fallback summary');
      expect(result.summary).toBe('fallback summary');
    });

    it('increments reactiveRetryCount', () => {
      const base = buildContextCompressionResult(makeTask());
      const result = applyReactiveCompactRetry(base, 'trigger', 'fallback');
      expect(result.reactiveRetryCount).toBe(1);
    });

    it('appends reactive_compact_retry to pipelineAudit', () => {
      const base = buildContextCompressionResult(makeTask());
      const result = applyReactiveCompactRetry(base, 'test-trigger', 'fallback');
      const retryAudit = result.pipelineAudit.find(a => a.stage === 'reactive_compact_retry');
      expect(retryAudit).toBeDefined();
      expect(retryAudit!.triggeredBy).toBe('test-trigger');
    });

    it('preserves other result fields', () => {
      const base = buildContextCompressionResult(makeTask());
      const result = applyReactiveCompactRetry(base, 'trigger', 'fallback');
      expect(result.compressionSource).toBe('heuristic');
      expect(result.artifactCount).toBe(base.artifactCount);
    });

    it('chains multiple retries', () => {
      const base = buildContextCompressionResult(makeTask({ goal: 'A'.repeat(300) }));
      const first = applyReactiveCompactRetry(base, 'trigger-1', 'fallback');
      const second = applyReactiveCompactRetry(first, 'trigger-2', 'fallback');
      expect(second.reactiveRetryCount).toBe(2);
      expect(second.pipelineAudit.filter(a => a.stage === 'reactive_compact_retry')).toHaveLength(2);
    });
  });
});
