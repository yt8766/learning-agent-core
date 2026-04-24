import { describe, expect, it } from 'vitest';

import { createIntelGraph } from '../src';
import { createIntelGraph as canonicalCreateIntelGraph } from '../src/graphs/intel/intel.graph';

describe('@agent/agents-intel-engine root exports', () => {
  it('keeps the intel graph entry wired to the canonical host', () => {
    expect(createIntelGraph).toBe(canonicalCreateIntelGraph);
    expect(createIntelGraph).toBeTypeOf('function');
  });
});
