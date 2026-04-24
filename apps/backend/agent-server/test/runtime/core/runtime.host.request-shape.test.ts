import { describe, expect, expectTypeOf, it } from 'vitest';

import { ModelInvocationFacade } from '@agent/runtime';

type InvocationRequest = Parameters<ModelInvocationFacade['invoke']>[0];

describe('RuntimeHost invocation request shape', () => {
  it('exposes context hints on facade invocation requests', () => {
    expectTypeOf<InvocationRequest['contextHints']>().toEqualTypeOf<Record<string, unknown>>();
    expect(true).toBe(true);
  });
});
