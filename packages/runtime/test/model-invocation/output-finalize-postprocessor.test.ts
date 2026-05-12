import { describe, expect, it } from 'vitest';

import { OutputFinalizePostprocessor } from '../../src/runtime/model-invocation/postprocessors/output-finalize-postprocessor';
import type { ModelInvocationPostprocessorContext } from '../../src/runtime/model-invocation/model-invocation.types';

function makeContext(overrides: Record<string, unknown> = {}): ModelInvocationPostprocessorContext {
  return {
    request: {} as any,
    decision: {} as any,
    providerResult: {
      outputText: 'Hello world',
      ...overrides
    }
  } as ModelInvocationPostprocessorContext;
}

describe('OutputFinalizePostprocessor', () => {
  const postprocessor = new OutputFinalizePostprocessor();

  it('has name "output-finalize"', () => {
    expect(postprocessor.name).toBe('output-finalize');
  });

  it('wraps provider outputText into a text finalOutput', () => {
    const context = makeContext({ outputText: 'Test output' });
    const result = postprocessor.run(context);
    expect(result.finalOutput).toEqual({ kind: 'text', text: 'Test output' });
  });

  it('returns deliveryMeta from providerResult when present', () => {
    const deliveryMeta = { latency: 120, cached: true };
    const context = makeContext({ outputText: 'output', deliveryMeta });
    const result = postprocessor.run(context);
    expect(result.deliveryMeta).toEqual({ latency: 120, cached: true });
  });

  it('returns empty deliveryMeta when providerResult has none', () => {
    const context = makeContext({ outputText: 'output' });
    const result = postprocessor.run(context);
    expect(result.deliveryMeta).toEqual({});
  });

  it('handles empty outputText', () => {
    const context = makeContext({ outputText: '' });
    const result = postprocessor.run(context);
    expect(result.finalOutput.text).toBe('');
  });

  it('handles long outputText', () => {
    const longText = 'a'.repeat(10000);
    const context = makeContext({ outputText: longText });
    const result = postprocessor.run(context);
    expect(result.finalOutput.text).toBe(longText);
  });

  it('preserves complex deliveryMeta structures', () => {
    const deliveryMeta = {
      nested: { key: 'value' },
      array: [1, 2, 3],
      flag: false,
      zero: 0
    };
    const context = makeContext({ outputText: 'text', deliveryMeta });
    const result = postprocessor.run(context);
    expect(result.deliveryMeta).toEqual(deliveryMeta);
  });
});
