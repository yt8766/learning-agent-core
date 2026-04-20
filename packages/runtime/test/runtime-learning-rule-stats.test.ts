import { describe, expect, it } from 'vitest';

import { countInvalidatedRules } from '../src/runtime/runtime-learning-rule-stats';

describe('runtime learning rule stats', () => {
  it('counts invalidated rules only', () => {
    expect(
      countInvalidatedRules([
        { id: 'rule-1', status: 'active' },
        { id: 'rule-2', status: 'invalidated' },
        { id: 'rule-3', status: 'invalidated' }
      ] as any)
    ).toBe(2);
  });
});
