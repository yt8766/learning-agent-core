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
  registerDefaultMcpSkillProviders,
  // LangChain adapters
  LangChainLoaderAdapter,
  createMarkdownDirectoryLoader,
  LangChainChunkerAdapter,
  LangChainEmbedderAdapter,
  // Chroma adapter
  ChromaVectorStoreAdapter,
  ChromaVectorSearchProvider,
  buildChromaKnowledgeFilterWhere,
  mapVectorMetadataToChromaMetadata,
  OpenSearchKeywordSearchProvider,
  buildOpenSearchKnowledgeFilter,
  createOpenSearchKeywordSearchProvider,
  parseOpenSearchKeywordSearchProviderConfig
} from '@agent/adapters';
import * as contractLlmProviderExports from '../src/contracts/llm';
import * as embeddingExports from '../src/openai-compatible/embeddings';
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

  it('exports shared utilities', () => {
    expect(normalizeMetadata).toBeTypeOf('function');
    expect(mergeMetadata).toBeTypeOf('function');
    expect(stableId).toBeTypeOf('function');
    expect(documentId).toBeTypeOf('function');
    expect(chunkId).toBeTypeOf('function');
    expect(AdapterError).toBeTypeOf('function');
    expect(validateVectorDimensions).toBeTypeOf('function');
  });

  it('exports LangChain adapters', () => {
    expect(LangChainLoaderAdapter).toBeTypeOf('function');
    expect(createMarkdownDirectoryLoader).toBeTypeOf('function');
    expect(LangChainChunkerAdapter).toBeTypeOf('function');
    expect(LangChainEmbedderAdapter).toBeTypeOf('function');
  });

  it('exports Chroma adapter', () => {
    expect(ChromaVectorStoreAdapter).toBeTypeOf('function');
    expect(ChromaVectorSearchProvider).toBeTypeOf('function');
    expect(buildChromaKnowledgeFilterWhere).toBeTypeOf('function');
    expect(mapVectorMetadataToChromaMetadata).toBeTypeOf('function');
  });

  it('exports OpenSearch-like full-text adapter', () => {
    expect(OpenSearchKeywordSearchProvider).toBeTypeOf('function');
    expect(buildOpenSearchKnowledgeFilter).toBeTypeOf('function');
    expect(createOpenSearchKeywordSearchProvider).toBeTypeOf('function');
    expect(parseOpenSearchKeywordSearchProviderConfig).toBeTypeOf('function');
  });

  it('exports default MCP skill providers', () => {
    expect(createMiniMaxMcpSkillProvider).toBeTypeOf('function');
    expect(createZhipuMcpSkillProvider).toBeTypeOf('function');
    expect(registerDefaultMcpSkillProviders).toBeTypeOf('function');
  });
});
