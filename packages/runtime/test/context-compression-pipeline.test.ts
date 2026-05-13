import { describe, expect, it } from 'vitest';

import { applyReactiveCompactRetry, buildContextCompressionResult } from '../src/utils/context-compression-pipeline';

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

describe('context-compression-pipeline', () => {
  describe('buildContextCompressionResult', () => {
    it('returns compression result with summary', () => {
      const result = buildContextCompressionResult(makeTask());
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.compressionSource).toBe('heuristic');
      expect(result.pipelineAudit).toBeInstanceOf(Array);
    });

    it('sets compressionApplied when content is trimmed', () => {
      const longContext = 'x'.repeat(500);
      const result = buildContextCompressionResult(makeTask({ context: longContext }));
      expect(result.compressionApplied).toBe(true);
    });

    it('detects error/log artifacts in content', () => {
      const result = buildContextCompressionResult(makeTask({ context: 'Error: stack trace here' }));
      expect(result.artifactCount).toBe(1);
      expect(result.compressionApplied).toBe(true);
    });

    it('detects stdout/stderr keywords', () => {
      const result = buildContextCompressionResult(makeTask({ context: 'stdout: test output' }));
      expect(result.artifactCount).toBe(1);
    });

    it('does not detect artifacts for clean content', () => {
      const result = buildContextCompressionResult(makeTask({ context: 'clean text' }));
      expect(result.artifactCount).toBe(0);
    });

    it('counts trace overflow', () => {
      const trace = Array.from({ length: 20 }, (_, i) => ({ node: `node-${i}`, summary: 's' }));
      const result = buildContextCompressionResult(makeTask({ trace }));
      expect(result.compressedMessageCount).toBe(12);
      expect(result.compressionApplied).toBe(true);
    });

    it('limits compressedMessageCount to 12', () => {
      const trace = Array.from({ length: 5 }, (_, i) => ({ node: `node-${i}`, summary: 's' }));
      const result = buildContextCompressionResult(makeTask({ trace }));
      expect(result.compressedMessageCount).toBe(5);
    });

    it('includes pipeline audit entries', () => {
      const result = buildContextCompressionResult(makeTask());
      expect(result.pipelineAudit.length).toBeGreaterThanOrEqual(4);
      const stages = result.pipelineAudit.map(a => a.stage);
      expect(stages).toContain('large_result_offload');
      expect(stages).toContain('micro_compression');
      expect(stages).toContain('history_trim');
      expect(stages).toContain('projection');
      expect(stages).toContain('conversation_summary');
    });

    it('uses planDraft summary when available', () => {
      const result = buildContextCompressionResult(makeTask({ planDraft: { summary: 'draft summary' } }));
      expect(result.summary).toContain('draft');
    });

    it('uses plan summary when available', () => {
      const result = buildContextCompressionResult(makeTask({ plan: { summary: 'plan summary' } }));
      expect(result.summary).toContain('plan');
    });

    it('handles undefined trace', () => {
      const result = buildContextCompressionResult(makeTask({ trace: undefined }));
      expect(result.compressedMessageCount).toBe(0);
    });
  });

  describe('applyReactiveCompactRetry', () => {
    it('increments reactiveRetryCount', () => {
      const base = buildContextCompressionResult(makeTask());
      const result = applyReactiveCompactRetry(base, 'test-trigger', 'fallback');
      expect(result.reactiveRetryCount).toBe(1);
    });

    it('truncates summary to 180 chars', () => {
      const base = {
        ...buildContextCompressionResult(makeTask()),
        summary: 'a'.repeat(300),
        compactedCharacterCount: 300
      };
      const result = applyReactiveCompactRetry(base, 'test', 'fallback');
      expect(result.summary.length).toBeLessThanOrEqual(180);
      expect(result.summary).toContain('...');
    });

    it('uses fallbackSummary when summary is empty', () => {
      const base = {
        ...buildContextCompressionResult(makeTask()),
        summary: '',
        compactedCharacterCount: 0
      };
      const result = applyReactiveCompactRetry(base, 'test', 'fallback summary');
      expect(result.summary).toBe('fallback summary');
    });

    it('appends reactive_compact_retry audit entry', () => {
      const base = buildContextCompressionResult(makeTask());
      const result = applyReactiveCompactRetry(base, 'review-stage', 'fallback');
      const retryAudit = result.pipelineAudit.find(a => a.stage === 'reactive_compact_retry');
      expect(retryAudit).toBeDefined();
      expect(retryAudit!.applied).toBe(true);
      expect(retryAudit!.triggeredBy).toBe('review-stage');
    });

    it('preserves base compression fields', () => {
      const base = buildContextCompressionResult(makeTask());
      const result = applyReactiveCompactRetry(base, 'test', 'fallback');
      expect(result.compressionSource).toBe(base.compressionSource);
      expect(result.artifactCount).toBe(base.artifactCount);
    });

    it('keeps summary under 180 when already short', () => {
      const base = {
        ...buildContextCompressionResult(makeTask()),
        summary: 'short'
      };
      const result = applyReactiveCompactRetry(base, 'test', 'fallback');
      expect(result.summary).toBe('short');
    });
  });
});
