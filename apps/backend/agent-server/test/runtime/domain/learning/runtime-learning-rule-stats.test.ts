import { describe, expect, it } from 'vitest';

import { countInvalidatedRules } from '../../../../src/runtime/domain/learning/runtime-learning-rule-stats';

describe('runtime learning rule stats', () => {
  it('counts invalidated rules from governance snapshots', () => {
    expect(
      countInvalidatedRules([
        { id: 'rule-1', status: 'invalidated' },
        { id: 'rule-2', status: 'active' },
        { id: 'rule-3', status: 'invalidated' }
      ] as any)
    ).toBe(2);
  });
});
