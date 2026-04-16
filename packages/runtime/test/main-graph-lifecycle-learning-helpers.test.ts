import { describe, expect, it } from 'vitest';

import {
  shouldEnqueueDreamTask,
  summarizeLearningCandidates
} from '../src/graphs/main/lifecycle/main-graph-lifecycle-learning-queue';

describe('main graph lifecycle learning helpers', () => {
  it('enqueues dream tasks for blocked or high-signal learning outcomes', () => {
    expect(
      shouldEnqueueDreamTask({
        review: { decision: 'blocked' }
      } as never)
    ).toBe(true);

    expect(
      shouldEnqueueDreamTask({
        learningEvaluation: {
          score: 90,
          notes: []
        }
      } as never)
    ).toBe(true);

    expect(
      shouldEnqueueDreamTask({
        learningEvaluation: {
          score: 10,
          notes: ['这是一次普通执行']
        }
      } as never)
    ).toBe(false);
  });

  it('summarizes learning candidate counts by type', () => {
    const summary = summarizeLearningCandidates({
      learningCandidates: [{ type: 'memory' }, { type: 'memory' }, { type: 'rule' }, { type: 'skill' }]
    } as never);

    expect(summary.counts).toEqual({
      memory: 2,
      rule: 1,
      skill: 1,
      reflection: 0,
      profile_patch: 0,
      override: 0
    });
    expect(summary.summary).toContain('memory 2');
    expect(summary.summary).toContain('rule 1');
    expect(summary.summary).toContain('skill 1');
  });
});
