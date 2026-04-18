import { describe, expect, it } from 'vitest';

import { generateObjectWithRetry, generateTextWithRetry, streamTextWithRetry } from '@agent/adapters';

import {
  generateObjectWithRetry as runtimeGenerateObjectWithRetry,
  generateTextWithRetry as runtimeGenerateTextWithRetry,
  streamTextWithRetry as runtimeStreamTextWithRetry
} from '../src/utils/llm-retry';

describe('runtime llm retry compat', () => {
  it('keeps legacy runtime llm retry helpers wired to the shared adapters implementation', () => {
    expect(runtimeGenerateObjectWithRetry).toBe(generateObjectWithRetry);
    expect(runtimeGenerateTextWithRetry).toBe(generateTextWithRetry);
    expect(runtimeStreamTextWithRetry).toBe(streamTextWithRetry);
  });
});
