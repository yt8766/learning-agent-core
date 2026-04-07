import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { extractJsonObject, jsonObjectInstruction } from '../../../src/adapters/llm/llm-provider';

describe('llm-provider helpers', () => {
  it('extracts direct and wrapped json objects', () => {
    expect(extractJsonObject('{"plan":"ok"}')).toEqual({ plan: 'ok' });
    expect(extractJsonObject('before\n{"nested":true}\nafter')).toEqual({ nested: true });
  });

  it('throws when no json object is present', () => {
    expect(() => extractJsonObject('plain text only')).toThrow('No JSON object found in model response.');
  });

  it('builds json-only instruction text from a schema', () => {
    const instruction = jsonObjectInstruction(
      z.object({
        answer: z.string(),
        confidence: z.number().min(0).max(1)
      })
    );

    expect(instruction).toContain('Return only a single JSON object');
    expect(instruction).toContain('"answer"');
    expect(instruction).toContain('"confidence"');
  });
});
