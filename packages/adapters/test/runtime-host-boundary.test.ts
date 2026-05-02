import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  createChatOpenAIModel,
  createDefaultRuntimeLlmProvider,
  createMiniMaxChatModel,
  createZhipuChatModel
} from '@agent/adapters';
import { createChatOpenAIModel as canonicalCreateChatOpenAIModel } from '../src/openai-compatible/chat';
import { createMiniMaxChatModel as canonicalCreateMiniMaxChatModel } from '../src/minimax/chat';
import { createZhipuChatModel as canonicalCreateZhipuChatModel } from '../src/zhipu/chat';
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

  it('removes the legacy compat barrel directories', () => {
    expect(existsSync(new URL('../src/chat/index.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/providers/llm/index.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/retry/index.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/support/index.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/utils/model-fallback.ts', import.meta.url))).toBe(false);
  });

  it('keeps the canonical factory host barrels in place', () => {
    expect(existsSync(new URL('../src/openai-compatible/chat/index.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/minimax/chat/index.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/zhipu/chat/index.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/factories/runtime/index.ts', import.meta.url))).toBe(true);
  });
});
