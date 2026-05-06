import { describe, expect, it } from 'vitest';

import { getChainNodeLabel } from '@/pages/runtime-overview/components/runtime-summary-visuals-helpers';

describe('runtime-summary-visuals-helpers', () => {
  it('maps main chain nodes and falls back for unknown nodes', () => {
    expect(getChainNodeLabel('entry_router')).toBeTruthy();
    expect(getChainNodeLabel('interrupt_controller')).toBeTruthy();
    expect(getChainNodeLabel('custom-node')).toBe('custom-node');
    expect(getChainNodeLabel()).toBe('链路待推进');
  });
});
