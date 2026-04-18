import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AnthropicProvider,
  createLlmProviderFactory,
  createChatOpenAIModel,
  createDefaultRuntimeLlmProvider,
  createOpenAIEmbeddingModel,
  createRuntimeEmbeddingProvider,
  createZhipuChatModel,
  jsonObjectInstruction
} from '@agent/adapters';
import * as contractLlmProviderExports from '../src/contracts/llm';
import * as embeddingExports from '../src/embeddings';
import { AnthropicProvider as canonicalAnthropicProvider } from '../src/providers/llm/anthropic';
import { createLlmProviderFactory as canonicalCreateLlmProviderFactory } from '../src/providers/llm/factories/create-llm-provider-factory';
import {
  createChatOpenAIModel as canonicalCreateChatOpenAIModel,
  createZhipuChatModel as canonicalCreateZhipuChatModel
} from '../src/chat';
import { createDefaultRuntimeLlmProvider as canonicalCreateDefaultRuntimeLlmProvider } from '../src/factories/runtime';

describe('@agent/adapters root exports', () => {
  it('re-exports canonical runtime and embedding hosts from the package root', () => {
    expect(createChatOpenAIModel).toBe(canonicalCreateChatOpenAIModel);
    expect(createZhipuChatModel).toBe(canonicalCreateZhipuChatModel);
    expect(createDefaultRuntimeLlmProvider).toBe(canonicalCreateDefaultRuntimeLlmProvider);
    expect(createOpenAIEmbeddingModel).toBe(embeddingExports.createOpenAIEmbeddingModel);
    expect(createRuntimeEmbeddingProvider).toBe(embeddingExports.createRuntimeEmbeddingProvider);
    expect(AnthropicProvider).toBe(canonicalAnthropicProvider);
    expect(createLlmProviderFactory).toBe(canonicalCreateLlmProviderFactory);
  });

  it('keeps the llm-provider contract facade aligned with the canonical host', () => {
    expect(jsonObjectInstruction).toBe(contractLlmProviderExports.jsonObjectInstruction);
  });

  it('retains the llm-provider contract facade as a stable contract-first entrypoint', () => {
    expect(existsSync(new URL('../src/contracts/llm-provider.ts', import.meta.url))).toBe(true);
    expect(existsSync(new URL('../src/contracts/llm/index.ts', import.meta.url))).toBe(true);
  });
});
