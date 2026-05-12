import { describe, expect, it } from 'vitest';

import { resolveExecutionSummaryForPersistence } from '../src/flows/review-stage/review-stage-persistence';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    contextFilterState: undefined,
    planDraft: undefined,
    plan: undefined,
    trace: [],
    ...overrides
  } as any;
}

describe('review-stage-persistence (direct)', () => {
  describe('resolveExecutionSummaryForPersistence', () => {
    it('returns summary unchanged when short and no error keywords', () => {
      const task = makeTask();
      const result = resolveExecutionSummaryForPersistence(task, 'Short summary');
      expect(result.summary).toBe('Short summary');
      expect(result.wasCompacted).toBe(false);
    });

    it('compacts when summary is longer than 1200 chars', () => {
      const task = makeTask();
      const longSummary = 'A'.repeat(1500);
      const result = resolveExecutionSummaryForPersistence(task, longSummary);
      expect(result.wasCompacted).toBe(true);
      expect(result.compression).toBeDefined();
    });

    it('compacts when summary contains "error" keyword', () => {
      const task = makeTask();
      const result = resolveExecutionSummaryForPersistence(task, 'Something went wrong with error in the code');
      expect(result.wasCompacted).toBe(true);
    });

    it('compacts when summary contains "stderr" keyword', () => {
      const task = makeTask();
      const result = resolveExecutionSummaryForPersistence(task, 'stderr output here');
      expect(result.wasCompacted).toBe(true);
    });

    it('compacts when summary contains "exception" keyword', () => {
      const task = makeTask();
      const result = resolveExecutionSummaryForPersistence(task, 'An exception occurred');
      expect(result.wasCompacted).toBe(true);
    });

    it('compacts when summary contains "failed" keyword', () => {
      const task = makeTask();
      const result = resolveExecutionSummaryForPersistence(task, 'The test failed');
      expect(result.wasCompacted).toBe(true);
    });

    it('compacts when summary contains "stack" keyword', () => {
      const task = makeTask();
      const result = resolveExecutionSummaryForPersistence(task, 'stack trace shows');
      expect(result.wasCompacted).toBe(true);
    });

    it('uses existing contextFilterState when present', () => {
      const task = makeTask({
        contextFilterState: {
          filteredContextSlice: {
            summary: 'existing compressed summary',
            compressionApplied: true,
            compressionSource: 'heuristic',
            compressedMessageCount: 5,
            artifactCount: 2,
            originalCharacterCount: 1000,
            compactedCharacterCount: 500,
            reactiveRetryCount: 0,
            pipelineAudit: []
          }
        }
      });
      const result = resolveExecutionSummaryForPersistence(task, 'A'.repeat(1500));
      expect(result.wasCompacted).toBe(true);
      expect(task.contextFilterState.filteredContextSlice.summary).toBeDefined();
    });

    it('sets contextFilterState when task has it', () => {
      const task = makeTask({
        contextFilterState: { filteredContextSlice: undefined }
      });
      resolveExecutionSummaryForPersistence(task, 'A'.repeat(1500));
      expect(task.contextFilterState.filteredContextSlice).toBeDefined();
    });

    it('does not set contextFilterState when task has none', () => {
      const task = makeTask();
      resolveExecutionSummaryForPersistence(task, 'A'.repeat(1500));
      expect(task.contextFilterState).toBeUndefined();
    });

    it('compression includes required fields', () => {
      const task = makeTask();
      const result = resolveExecutionSummaryForPersistence(task, 'A'.repeat(1500));
      expect(result.compression).toHaveProperty('summary');
      expect(result.compression).toHaveProperty('compressionApplied');
      expect(result.compression).toHaveProperty('compressionSource');
      expect(result.compression).toHaveProperty('originalCharacterCount');
      expect(result.compression).toHaveProperty('compactedCharacterCount');
      expect(result.compression).toHaveProperty('reactiveRetryCount');
    });

    it('does not compact short summary without error keywords', () => {
      const task = makeTask();
      const result = resolveExecutionSummaryForPersistence(task, 'All tests passed successfully');
      expect(result.wasCompacted).toBe(false);
      expect(result.summary).toBe('All tests passed successfully');
    });
  });
});
