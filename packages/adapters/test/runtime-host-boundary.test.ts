import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  createChatOpenAIModel,
  createDefaultRuntimeLlmProvider,
  createMiniMaxChatModel,
  createZhipuChatModel
} from '@agent/adapters';
import {
  createChatOpenAIModel as canonicalCreateChatOpenAIModel,
  createMiniMaxChatModel as canonicalCreateMiniMaxChatModel,
  createZhipuChatModel as canonicalCreateZhipuChatModel
} from '../src/chat';
import { createDefaultRuntimeLlmProvider as canonicalCreateDefaultRuntimeLlmProvider } from '../src/factories/runtime';

describe('@agent/adapters runtime host boundary', () => {
  it('keeps root chat factories wired to the canonical runtime host', () => {
    expect(createChatOpenAIModel).toBe(canonicalCreateChatOpenAIModel);
    expect(createMiniMaxChatModel).toBe(canonicalCreateMiniMaxChatModel);
    expect(createZhipuChatModel).toBe(canonicalCreateZhipuChatModel);
  });

  it('keeps the root runtime provider factory wired to the canonical runtime host', () => {
    expect(createDefaultRuntimeLlmProvider).toBe(canonicalCreateDefaultRuntimeLlmProvider);
  });

  it('removes the legacy compat runtime entry files', () => {
    expect(existsSync(new URL('../src/chat/chat-model-factory.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/llm/runtime-provider-factory.ts', import.meta.url))).toBe(false);
  });

  it('keeps the new factory host barrels in place', () => {
    expect(existsSync(new URL('../src/chat/index.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/factories/runtime/index.ts', import.meta.url))).toBe(true);
  });
});
