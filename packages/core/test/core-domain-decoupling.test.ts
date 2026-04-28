import { describe, expect, it } from 'vitest';

import { BudgetStateSchema, EvidenceRecordSchema, LearningCandidateRecordSchema, MemoryScopeTypeSchema } from '../src';

describe('core domain decoupling', () => {
  it('keeps tasking and channel stable fields local to core', () => {
    expect(MemoryScopeTypeSchema.parse('workspace')).toBe('workspace');

    expect(
      EvidenceRecordSchema.parse({
        id: 'evidence-1',
        taskId: 'task-1',
        sourceType: 'document',
        trustClass: 'internal',
        summary: 'Referenced source',
        createdAt: '2026-04-28T00:00:00.000Z'
      })
    ).toMatchObject({ id: 'evidence-1' });

    expect(
      LearningCandidateRecordSchema.parse({
        id: 'candidate-1',
        taskId: 'task-1',
        type: 'memory',
        summary: 'Remember this',
        status: 'pending_confirmation',
        payload: {},
        createdAt: '2026-04-28T00:00:00.000Z'
      })
    ).toMatchObject({ id: 'candidate-1' });

    expect(
      BudgetStateSchema.parse({
        stepBudget: 3,
        stepsConsumed: 1,
        retryBudget: 2,
        retriesConsumed: 0,
        sourceBudget: 4,
        sourcesConsumed: 1
      })
    ).toMatchObject({ stepBudget: 3 });
  });
});
