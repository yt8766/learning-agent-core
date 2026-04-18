import { describe, expect, it } from 'vitest';

import { createModelCapabilities, MODEL_CAPABILITIES } from '@agent/adapters';

describe('@agent/adapters model capabilities', () => {
  it('exports stable capability constants for provider/model declarations', () => {
    expect(MODEL_CAPABILITIES).toEqual({
      TEXT: 'text',
      TOOL_CALL: 'tool-call',
      EMBEDDING: 'embedding',
      THINKING: 'thinking'
    });
  });

  it('provides a helper for building typed capability arrays without ad-hoc string literals', () => {
    expect(createModelCapabilities(MODEL_CAPABILITIES.TEXT, MODEL_CAPABILITIES.TOOL_CALL)).toEqual([
      'text',
      'tool-call'
    ]);
  });
});
