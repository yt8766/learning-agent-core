import type { RuleRecord } from '@agent/core';

export function countInvalidatedRules(items: RuleRecord[]) {
  return items.filter(item => item.status === 'invalidated').length;
}
