import { describe, expect, it } from 'vitest';

import { IntelAlertSchema, IntelDeliverySchema, IntelSignalSchema, createIntelGraph } from '../src';
import { createIntelGraph as canonicalCreateIntelGraph } from '../src/graphs/intel/intel.graph';
import { IntelSignalSchema as canonicalIntelSignalSchema } from '../src/types/intel-signal.schema';

describe('@agent/agents-intel-engine root exports', () => {
  it('keeps the intel graph entry wired to the canonical host', () => {
    expect(createIntelGraph).toBe(canonicalCreateIntelGraph);
    expect(createIntelGraph).toBeTypeOf('function');
  });

  it('exposes intel contracts from the intel-engine package boundary', () => {
    expect(IntelSignalSchema).toBe(canonicalIntelSignalSchema);
    expect(
      IntelSignalSchema.safeParse({
        id: 'signal_1',
        dedupeKey: 'topic:event',
        category: 'ai_release',
        eventType: 'release',
        title: 'Model release',
        summary: 'A relevant AI model release.',
        priority: 'P1',
        confidence: 'high',
        status: 'pending',
        firstSeenAt: '2026-04-27T00:00:00.000Z',
        lastSeenAt: '2026-04-27T00:00:00.000Z'
      }).success
    ).toBe(true);
    expect(IntelAlertSchema.safeParse({}).success).toBe(false);
    expect(IntelDeliverySchema.safeParse({}).success).toBe(false);
  });
});
