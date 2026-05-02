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
  jsonObjectInstruction,
  // Shared utilities
  normalizeMetadata,
  mergeMetadata,
  stableId,
  documentId,
  chunkId,
  AdapterError,
  validateVectorDimensions,
  createMiniMaxMcpSkillProvider,
  createZhipuMcpSkillProvider,
  registerDefaultMcpSkillProviders
} from '@agent/adapters';
import * as contractLlmProviderExports from '../src/contracts/llm';
import * as embeddingExports from '../src/openai-compatible/embeddings';
import { AnthropicProvider as canonicalAnthropicProvider } from '../src/anthropic/provider';
import { createLlmProviderFactory as canonicalCreateLlmProviderFactory } from '../src/factories/llm';
import { createChatOpenAIModel as canonicalCreateChatOpenAIModel } from '../src/openai-compatible/chat';
import { createZhipuChatModel as canonicalCreateZhipuChatModel } from '../src/zhipu/chat';
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

  it('exports shared utilities', () => {
    expect(normalizeMetadata).toBeTypeOf('function');
    expect(mergeMetadata).toBeTypeOf('function');
    expect(stableId).toBeTypeOf('function');
    expect(documentId).toBeTypeOf('function');
    expect(chunkId).toBeTypeOf('function');
    expect(AdapterError).toBeTypeOf('function');
    expect(validateVectorDimensions).toBeTypeOf('function');
  });

  it('exports default MCP skill providers', () => {
    expect(createMiniMaxMcpSkillProvider).toBeTypeOf('function');
    expect(createZhipuMcpSkillProvider).toBeTypeOf('function');
    expect(registerDefaultMcpSkillProviders).toBeTypeOf('function');
  });
});
