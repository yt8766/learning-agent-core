import { describe, expect, it } from 'vitest';

import { matchesRunObservatoryTaskFilters } from '../../src/runtime-observability/runtime-observability-task-filters';

describe('runtime observability task filters', () => {
  it('matches task models from llm usage, model route, and trace records', () => {
    expect(
      matchesRunObservatoryTaskFilters(
        {
          llmUsage: {
            models: [{ model: 'gpt-5.4-mini', pricingSource: 'estimated' }]
          },
          modelRoute: [{ selectedModel: 'gpt-5.4' }],
          trace: [{ modelUsed: 'gpt-5.4-mini' }]
        },
        {
          model: 'gpt-5.4-mini',
          pricingSource: 'estimated'
        }
      )
    ).toBe(true);
  });
});
