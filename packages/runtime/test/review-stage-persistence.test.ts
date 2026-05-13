import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/context-compression-pipeline', () => ({
  buildContextCompressionResult: vi.fn().mockReturnValue({
    summary: 'compressed',
    compressionApplied: true,
    compressionSource: 'heuristic',
    compressedMessageCount: 5,
    artifactCount: 1,
    originalCharacterCount: 500,
    compactedCharacterCount: 200,
    reactiveRetryCount: 0,
    pipelineAudit: []
  }),
  applyReactiveCompactRetry: vi.fn().mockReturnValue({
    summary: 'reactive compressed',
    compressionApplied: true,
    compressionSource: 'heuristic',
    compressedMessageCount: 5,
    artifactCount: 1,
    originalCharacterCount: 500,
    compactedCharacterCount: 180,
    reactiveRetryCount: 1,
    pipelineAudit: []
  })
}));

import { resolveExecutionSummaryForPersistence } from '../src/flows/review-stage/review-stage-persistence';

describe('review-stage-persistence', () => {
  describe('resolveExecutionSummaryForPersistence', () => {
    it('returns uncompacted for short summary', () => {
      const task = { goal: 'test' } as any;
      const result = resolveExecutionSummaryForPersistence(task, 'short summary');
      expect(result.wasCompacted).toBe(false);
      expect(result.summary).toBe('short summary');
    });

    it('compacts long summary', () => {
      const task = { goal: 'test' } as any;
      const longSummary = 'x'.repeat(1500);
      const result = resolveExecutionSummaryForPersistence(task, longSummary);
      expect(result.wasCompacted).toBe(true);
    });

    it('compacts summary with error keywords', () => {
      const task = { goal: 'test' } as any;
      const result = resolveExecutionSummaryForPersistence(task, 'Error: something failed with stack trace');
      expect(result.wasCompacted).toBe(true);
    });

    it('compacts summary with stderr keyword', () => {
      const task = { goal: 'test' } as any;
      const result = resolveExecutionSummaryForPersistence(task, 'output from stderr');
      expect(result.wasCompacted).toBe(true);
    });

    it('compacts summary with exception keyword', () => {
      const task = { goal: 'test' } as any;
      const result = resolveExecutionSummaryForPersistence(task, 'an exception occurred');
      expect(result.wasCompacted).toBe(true);
    });

    it('compacts summary with failed keyword', () => {
      const task = { goal: 'test' } as any;
      const result = resolveExecutionSummaryForPersistence(task, 'tests failed');
      expect(result.wasCompacted).toBe(true);
    });

    it('uses existing contextFilterState slice when present', () => {
      const task = {
        goal: 'test',
        contextFilterState: {
          filteredContextSlice: {
            summary: 'existing',
            compressionApplied: false,
            compressionSource: 'heuristic',
            compressedMessageCount: 0,
            artifactCount: 0,
            originalCharacterCount: 100,
            compactedCharacterCount: 100,
            reactiveRetryCount: 0,
            pipelineAudit: []
          }
        }
      } as any;
      const longSummary = 'x'.repeat(1500);
      const result = resolveExecutionSummaryForPersistence(task, longSummary);
      expect(result.wasCompacted).toBe(true);
    });

    it('updates contextFilterState when present and compacting', () => {
      const task = {
        goal: 'test',
        contextFilterState: {
          filteredContextSlice: {
            summary: 'existing summary',
            compressionApplied: false,
            compressionSource: 'heuristic',
            compressedMessageCount: 0,
            artifactCount: 0,
            originalCharacterCount: 100,
            compactedCharacterCount: 100,
            reactiveRetryCount: 0,
            pipelineAudit: []
          }
        }
      } as any;
      const longSummary = 'x'.repeat(1500);
      resolveExecutionSummaryForPersistence(task, longSummary);
      expect(task.contextFilterState.filteredContextSlice.summary).toBeDefined();
    });

    it('returns compression metadata', () => {
      const task = { goal: 'test' } as any;
      const result = resolveExecutionSummaryForPersistence(task, 'short');
      expect(result.compression).toBeDefined();
    });

    it('detects stdout keyword', () => {
      const task = { goal: 'test' } as any;
      const result = resolveExecutionSummaryForPersistence(task, 'stdout output here');
      expect(result.wasCompacted).toBe(true);
    });

    it('detects trace keyword', () => {
      const task = { goal: 'test' } as any;
      const result = resolveExecutionSummaryForPersistence(task, 'stack trace follows');
      expect(result.wasCompacted).toBe(true);
    });

    it('detects error keyword in mixed case', () => {
      const task = { goal: 'test' } as any;
      const result = resolveExecutionSummaryForPersistence(task, 'Warning: ERROR detected');
      expect(result.wasCompacted).toBe(true);
    });
  });
});
