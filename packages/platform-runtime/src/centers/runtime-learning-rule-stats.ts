import type { RuleRecord } from '@agent/memory';

export function countInvalidatedRules(items: RuleRecord[]) {
  return items.filter(item => item.status === 'invalidated').length;
}
