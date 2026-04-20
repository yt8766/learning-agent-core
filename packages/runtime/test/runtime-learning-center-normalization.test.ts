import { describe, expect, it } from 'vitest';

import {
  normalizeLearningCenterJobs,
  normalizeLearningCenterTasks
} from '../src/runtime/runtime-learning-center-normalization';

describe('runtime learning center normalization', () => {
  it('normalizes task learning evaluation confidence to numbers when possible', () => {
    const result = normalizeLearningCenterTasks([
      {
        id: 'task-1',
        learningEvaluation: {
          confidence: '42'
        }
      }
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'task-1',
        learningEvaluation: expect.objectContaining({
          confidence: 42
        })
      })
    ]);
  });

  it('normalizes job learning evaluation arrays and persisted memory ids', () => {
    const result = normalizeLearningCenterJobs([
      {
        id: 'job-1',
        sourceType: 'research',
        conflictDetected: true,
        updatedAt: '2026-04-19T10:00:00.000Z',
        persistedMemoryIds: ['memory-1', 2, 'memory-3'],
        learningEvaluation: {
          confidence: '0.75',
          candidateReasons: ['stable preference', 1],
          skippedReasons: ['duplicate', null],
          expertiseSignals: ['architecture', false]
        }
      }
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'job-1',
        sourceType: 'research',
        conflictDetected: true,
        persistedMemoryIds: ['memory-1', 'memory-3'],
        learningEvaluation: expect.objectContaining({
          confidence: 0.75,
          candidateReasons: ['stable preference'],
          skippedReasons: ['duplicate'],
          expertiseSignals: ['architecture']
        })
      })
    ]);
  });
});
