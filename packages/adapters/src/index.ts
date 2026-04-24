export type {
  IEmbeddingProvider,
  ILLMProvider,
  IToolProvider,
  LlmProviderAgentRole,
  LlmProviderCapability,
  LlmProviderMessage,
  LlmProviderModelInfo,
  LlmProviderOptions
} from '@agent/core';

// LLM contracts — canonical
export type { ChatMessage, GenerateTextOptions, LlmProvider, LlmUsageMetadata } from './contracts/llm';
export {
  createModelCapabilities,
  jsonObjectInstruction,
  modelSupportsCapabilities,
  MODEL_CAPABILITIES
} from './contracts/llm';

// Factories — canonical
export { createDefaultRuntimeLlmProvider, type DefaultRuntimeLlmProviderOptions } from './factories/runtime';
export {
  createLlmProviderFactory,
  LlmProviderFactoryRegistry,
  registerDefaultLlmProviderFactories
} from './factories/llm';
export type { LlmProviderFactory } from './factories/llm';

// Providers — canonical
export { OpenAICompatibleProvider } from './openai-compatible/provider';
export { AnthropicProvider } from './anthropic/provider';
export { MiniMaxProvider } from './minimax/provider';
export { ZhipuLlmProvider } from './zhipu/provider';
export * from './openai-compatible/chat';
export * from './openai-compatible/embeddings';
export * from './minimax/chat';
export * from './zhipu/chat';

// Routing — canonical
export { ModelRouter, ProviderRegistry, RoutedLlmProvider } from './routing/llm';
export type { SemanticCacheRepository, SemanticCacheRecord, ResolvedModel, ModelRequest } from './routing/llm';

// Resilience — canonical
export type { LlmRetryOptions } from './resilience/llm-retry';
export {
  generateObjectWithRetry,
  generateTextWithRetry,
  streamTextWithRetry,
  withLlmRetry,
  withReactiveContextRetry,
  shouldFallbackModel,
  withFallbackModel
} from './resilience';

// Prompts & structured output
export { JSON_SAFETY_PROMPT, appendJsonSafety, appendJsonSafetyIfMissing, appendJsonSafetyToMessages } from './prompts';
export { buildStructuredPrompt, safeGenerateObject } from './structured-output';
export type {
  SafeGenerateObjectResult,
  SafeGenerateObjectRetryOptions,
  StructuredContractMeta,
  StructuredParseStatus
} from './structured-output';

// Shared utilities — canonical
export { normalizeEmbeddingBaseUrl, normalizeModelBaseUrl } from './shared/urls';
export {
  normalizeMetadata,
  mergeMetadata,
  stableId,
  documentId,
  chunkId,
  AdapterError,
  validateVectorDimensions
} from './shared';

// LangChain adapters
export {
  LangChainLoaderAdapter,
  createMarkdownDirectoryLoader,
  LangChainChunkerAdapter,
  createRecursiveTextSplitterChunker,
  createMarkdownTextSplitterChunker,
  createTokenTextSplitterChunker,
  LangChainEmbedderAdapter,
  mapLangChainDocumentToCoreDocument,
  mapLangChainSplitToCoreChunk,
  mapCoreDocumentToLangChainDocument
} from './langchain';

// Chroma adapter
export {
  ChromaVectorStoreAdapter,
  createChromaClient,
  getOrCreateChromaCollection,
  mapVectorMetadataToChromaMetadata
} from './chroma';
export type { ChromaVectorStoreOptions, ChromaClientOptions, ChromaClientLike, ChromaCollectionLike } from './chroma';

// MCP skill providers
export {
  buildMiniMaxMcpCapabilities,
  buildZhipuMcpCapabilities,
  createMiniMaxMcpSkillProvider,
  createZhipuMcpSkillProvider,
  registerDefaultMcpSkillProviders
} from './mcp';
export type {
  AdapterMcpCapabilityDefinition,
  AdapterMcpServerDefinition,
  AdapterMcpSkillProviderAdapter,
  AdapterMcpSkillProviderInstallInput,
  AdapterMcpSkillProviderRegistryLike,
  AdapterMcpTransport
} from './mcp';
