# Knowledge Provider Adapters Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-05-02

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first independently testable `packages/knowledge/src/adapters` foundation so `@agent/knowledge` can create MiniMax, GLM, DeepSeek, and OpenAI-compatible chat or embedding providers through LangChain `ChatOpenAI` / `OpenAIEmbeddings`.

**Architecture:** This plan covers the SDK adapter foundation only. `core` owns stable provider contracts and error types; `adapters` owns LangChain wrappers and vendor presets; `runtime` and backend wiring remain consumers and are covered by later plans. No LangChain type may leak into `core`, root API DTOs, trace records, database records, or frontend types.

**Tech Stack:** TypeScript, Zod, Vitest, tsup, pnpm workspace, `@langchain/openai`.

---

## Scope Check

The approved spec spans SDK adapters, backend provider resolution, ingestion metadata, RAG generation, frontend configuration, and observability. This plan intentionally implements the first sub-project only: the `packages/knowledge` SDK adapter layer and its exports. Backend and frontend work should be planned separately after this foundation lands.

This plan must run in the current checkout. Do not use `git worktree`.

## File Structure

- Modify: `packages/knowledge/package.json`
  - Add `@langchain/openai` as a package dependency.
- Modify: `pnpm-lock.yaml`
  - Updated by `pnpm add --dir packages/knowledge @langchain/openai`.
- Modify: `packages/knowledge/tsup.config.ts`
  - Add adapter subpath entries so published builds include `adapters` entrypoints.
- Modify: `packages/knowledge/src/core/schemas/index.ts`
  - Add schema-first provider model contracts.
- Modify: `packages/knowledge/src/core/types/index.ts`
  - Export inferred provider model types.
- Modify: `packages/knowledge/src/core/interfaces/index.ts`
  - Add `KnowledgeChatProvider`, `KnowledgeEmbeddingProvider`, `KnowledgeRerankProvider`, and `KnowledgeJudgeProvider`.
- Modify: `packages/knowledge/src/core/errors/index.ts`
  - Add `KnowledgeProviderError`.
- Create: `packages/knowledge/src/adapters/shared/provider-errors.ts`
  - Convert unknown LangChain/vendor errors into `KnowledgeProviderError`.
- Create: `packages/knowledge/src/adapters/shared/langchain-message.ts`
  - Convert SDK chat messages to LangChain-compatible message objects and extract assistant text.
- Create: `packages/knowledge/src/adapters/shared/langchain-usage.ts`
  - Normalize token usage from LangChain response metadata.
- Create: `packages/knowledge/src/adapters/shared/index.ts`
  - Shared adapter exports.
- Create: `packages/knowledge/src/adapters/langchain/chat/langchain-chat-provider.ts`
  - Wrapper from generic LangChain chat model to `KnowledgeChatProvider`.
- Create: `packages/knowledge/src/adapters/langchain/chat/chat-openai-provider.ts`
  - Factory that creates `ChatOpenAI` and wraps it.
- Create: `packages/knowledge/src/adapters/langchain/chat/index.ts`
  - Chat adapter exports.
- Create: `packages/knowledge/src/adapters/langchain/embeddings/langchain-embedding-provider.ts`
  - Wrapper from generic LangChain embeddings model to `KnowledgeEmbeddingProvider`.
- Create: `packages/knowledge/src/adapters/langchain/embeddings/openai-embeddings-provider.ts`
  - Factory that creates `OpenAIEmbeddings` and wraps it.
- Create: `packages/knowledge/src/adapters/langchain/embeddings/index.ts`
  - Embedding adapter exports.
- Create: `packages/knowledge/src/adapters/langchain/index.ts`
  - LangChain adapter exports.
- Create: `packages/knowledge/src/adapters/openai-compatible/openai-compatible-chat-openai.ts`
  - Generic OpenAI-compatible chat preset.
- Create: `packages/knowledge/src/adapters/openai-compatible/openai-compatible-embeddings.ts`
  - Generic OpenAI-compatible embedding preset.
- Create: `packages/knowledge/src/adapters/openai-compatible/index.ts`
  - OpenAI-compatible exports.
- Create: `packages/knowledge/src/adapters/minimax/minimax-chat-openai.ts`
  - MiniMax chat preset.
- Create: `packages/knowledge/src/adapters/minimax/minimax-embeddings-openai.ts`
  - MiniMax embedding preset.
- Create: `packages/knowledge/src/adapters/minimax/index.ts`
  - MiniMax exports.
- Create: `packages/knowledge/src/adapters/glm/glm-chat-openai.ts`
  - GLM chat preset.
- Create: `packages/knowledge/src/adapters/glm/glm-embeddings-openai.ts`
  - GLM embedding preset.
- Create: `packages/knowledge/src/adapters/glm/index.ts`
  - GLM exports.
- Create: `packages/knowledge/src/adapters/deepseek/deepseek-chat-openai.ts`
  - DeepSeek chat preset.
- Create: `packages/knowledge/src/adapters/deepseek/index.ts`
  - DeepSeek exports.
- Create: `packages/knowledge/src/adapters/index.ts`
  - Public adapter barrel.
- Modify: `packages/knowledge/package.json`
  - Add `./adapters`, `./adapters/langchain`, `./adapters/minimax`, `./adapters/glm`, `./adapters/deepseek`, and `./adapters/openai-compatible` exports.
- Test: `packages/knowledge/test/provider-contracts.test.ts`
  - Provider contract schema and type regression tests.
- Test: `packages/knowledge/test/langchain-adapters.test.ts`
  - Fake LangChain model wrapper tests.
- Test: `packages/knowledge/test/provider-presets.test.ts`
  - Preset factory construction tests using a mock `@langchain/openai`.
- Test: `packages/knowledge/test/sdk-entrypoints.test.ts`
  - Adapter subpath export regression tests.
- Modify docs: `docs/sdk/knowledge.md`
  - Document adapter subpaths, MiniMax default, and LangChain boundary.
- Modify docs: `docs/packages/knowledge/README.md`
  - Add adapter layer as a current package boundary.

## Task 1: Add Dependency And Adapter Entrypoints

**Files:**

- Modify: `packages/knowledge/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/knowledge/tsup.config.ts`
- Test: `packages/knowledge/test/sdk-entrypoints.test.ts`

- [ ] **Step 1: Install `@langchain/openai` for `@agent/knowledge`**

Run:

```bash
pnpm add --dir packages/knowledge @langchain/openai
```

Expected: `packages/knowledge/package.json` includes `@langchain/openai`, and `pnpm-lock.yaml` changes.

- [ ] **Step 2: Add failing export regression tests**

Append these tests to `packages/knowledge/test/sdk-entrypoints.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('knowledge adapter entrypoints', () => {
  it('exports the adapter root entrypoint', async () => {
    const adapters = await import('../src/adapters');

    expect(adapters).toHaveProperty('LangChainChatProvider');
    expect(adapters).toHaveProperty('createMiniMaxChatProvider');
    expect(adapters).toHaveProperty('createOpenAICompatibleEmbeddingProvider');
  });

  it('exports vendor adapter entrypoints', async () => {
    const minimax = await import('../src/adapters/minimax');
    const glm = await import('../src/adapters/glm');
    const deepseek = await import('../src/adapters/deepseek');
    const compatible = await import('../src/adapters/openai-compatible');

    expect(minimax).toHaveProperty('createMiniMaxEmbeddingProvider');
    expect(glm).toHaveProperty('createGlmChatProvider');
    expect(deepseek).toHaveProperty('createDeepSeekChatProvider');
    expect(compatible).toHaveProperty('createOpenAICompatibleChatProvider');
  });
});
```

- [ ] **Step 3: Run the entrypoint test and verify it fails**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/sdk-entrypoints.test.ts
```

Expected: FAIL because `../src/adapters` does not exist yet.

- [ ] **Step 4: Add empty adapter barrels**

Create these files:

```ts
// packages/knowledge/src/adapters/index.ts
export * from './langchain';
export * from './minimax';
export * from './glm';
export * from './deepseek';
export * from './openai-compatible';
```

```ts
// packages/knowledge/src/adapters/langchain/index.ts
export * from './chat';
export * from './embeddings';
```

```ts
// packages/knowledge/src/adapters/langchain/chat/index.ts
export class LangChainChatProvider {}

export function createChatOpenAIProvider() {
  return new LangChainChatProvider();
}
```

```ts
// packages/knowledge/src/adapters/langchain/embeddings/index.ts
export class LangChainEmbeddingProvider {}

export function createOpenAIEmbeddingsProvider() {
  return new LangChainEmbeddingProvider();
}
```

```ts
// packages/knowledge/src/adapters/minimax/index.ts
export function createMiniMaxChatProvider() {
  return {};
}

export function createMiniMaxEmbeddingProvider() {
  return {};
}
```

```ts
// packages/knowledge/src/adapters/glm/index.ts
export function createGlmChatProvider() {
  return {};
}

export function createGlmEmbeddingProvider() {
  return {};
}
```

```ts
// packages/knowledge/src/adapters/deepseek/index.ts
export function createDeepSeekChatProvider() {
  return {};
}
```

```ts
// packages/knowledge/src/adapters/openai-compatible/index.ts
export function createOpenAICompatibleChatProvider() {
  return {};
}

export function createOpenAICompatibleEmbeddingProvider() {
  return {};
}
```

- [ ] **Step 5: Add build and package exports**

Update `packages/knowledge/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

const entry = [
  'src/index.ts',
  'src/core/index.ts',
  'src/client/index.ts',
  'src/browser/index.ts',
  'src/node/index.ts',
  'src/adapters/index.ts',
  'src/adapters/langchain/index.ts',
  'src/adapters/minimax/index.ts',
  'src/adapters/glm/index.ts',
  'src/adapters/deepseek/index.ts',
  'src/adapters/openai-compatible/index.ts'
];

export default defineConfig([
  {
    entry,
    format: ['cjs'],
    outDir: 'build/cjs',
    treeshake: true
  },
  {
    entry,
    format: ['esm'],
    outDir: 'build/esm',
    treeshake: true
  }
]);
```

Add these entries to `packages/knowledge/package.json` under `exports`:

```json
"./adapters": {
  "import": {
    "types": "./build/types/src/adapters/index.d.ts",
    "default": "./build/esm/adapters/index.mjs"
  },
  "require": {
    "types": "./build/types/src/adapters/index.d.ts",
    "default": "./build/cjs/adapters/index.js"
  }
},
"./adapters/langchain": {
  "import": {
    "types": "./build/types/src/adapters/langchain/index.d.ts",
    "default": "./build/esm/adapters/langchain/index.mjs"
  },
  "require": {
    "types": "./build/types/src/adapters/langchain/index.d.ts",
    "default": "./build/cjs/adapters/langchain/index.js"
  }
},
"./adapters/minimax": {
  "import": {
    "types": "./build/types/src/adapters/minimax/index.d.ts",
    "default": "./build/esm/adapters/minimax/index.mjs"
  },
  "require": {
    "types": "./build/types/src/adapters/minimax/index.d.ts",
    "default": "./build/cjs/adapters/minimax/index.js"
  }
},
"./adapters/glm": {
  "import": {
    "types": "./build/types/src/adapters/glm/index.d.ts",
    "default": "./build/esm/adapters/glm/index.mjs"
  },
  "require": {
    "types": "./build/types/src/adapters/glm/index.d.ts",
    "default": "./build/cjs/adapters/glm/index.js"
  }
},
"./adapters/deepseek": {
  "import": {
    "types": "./build/types/src/adapters/deepseek/index.d.ts",
    "default": "./build/esm/adapters/deepseek/index.mjs"
  },
  "require": {
    "types": "./build/types/src/adapters/deepseek/index.d.ts",
    "default": "./build/cjs/adapters/deepseek/index.js"
  }
},
"./adapters/openai-compatible": {
  "import": {
    "types": "./build/types/src/adapters/openai-compatible/index.d.ts",
    "default": "./build/esm/adapters/openai-compatible/index.mjs"
  },
  "require": {
    "types": "./build/types/src/adapters/openai-compatible/index.d.ts",
    "default": "./build/cjs/adapters/openai-compatible/index.js"
  }
}
```

- [ ] **Step 6: Verify the export regression test passes**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/sdk-entrypoints.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/knowledge/package.json pnpm-lock.yaml packages/knowledge/tsup.config.ts packages/knowledge/src/adapters packages/knowledge/test/sdk-entrypoints.test.ts
git commit -m "feat: add knowledge adapter entrypoints"
```

## Task 2: Define Core Provider Contracts

**Files:**

- Modify: `packages/knowledge/src/core/schemas/index.ts`
- Modify: `packages/knowledge/src/core/types/index.ts`
- Modify: `packages/knowledge/src/core/interfaces/index.ts`
- Modify: `packages/knowledge/src/core/errors/index.ts`
- Test: `packages/knowledge/test/provider-contracts.test.ts`

- [ ] **Step 1: Write the failing provider contract tests**

Create `packages/knowledge/test/provider-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  KnowledgeModelBindingSchema,
  KnowledgeModelProfileSchema,
  KnowledgeProviderError,
  type KnowledgeChatProvider,
  type KnowledgeEmbeddingProvider
} from '../src/core';

describe('knowledge provider contracts', () => {
  it('parses workspace and knowledge base model profile bindings', () => {
    expect(
      KnowledgeModelProfileSchema.parse({
        embedding: {
          providerId: 'minimax',
          adapter: 'langchain-chat-openai',
          model: 'minimax-embedding',
          baseUrl: 'https://api.minimaxi.com/v1',
          dimensions: 1536
        },
        chat: {
          providerId: 'minimax',
          adapter: 'langchain-chat-openai',
          model: 'MiniMax-M2.7',
          baseUrl: 'https://api.minimaxi.com/v1'
        },
        rerank: {
          enabled: false,
          providerId: 'minimax',
          adapter: 'langchain-chat-openai',
          model: 'MiniMax-M2.7'
        }
      })
    ).toMatchObject({
      embedding: { providerId: 'minimax', dimensions: 1536 },
      rerank: { enabled: false }
    });
  });

  it('rejects secret fields and invalid dimensions in model bindings', () => {
    expect(() =>
      KnowledgeModelBindingSchema.parse({
        providerId: 'minimax',
        adapter: 'langchain-chat-openai',
        model: 'MiniMax-M2.7',
        apiKey: 'secret'
      })
    ).toThrow();

    expect(() =>
      KnowledgeModelBindingSchema.parse({
        providerId: 'minimax',
        adapter: 'langchain-chat-openai',
        model: 'embedding',
        dimensions: 0
      })
    ).toThrow();
  });

  it('allows chat and embedding providers to be implemented without LangChain types', async () => {
    const chat: KnowledgeChatProvider = {
      providerId: 'fake',
      defaultModel: 'fake-chat',
      async generate(input) {
        return {
          text: input.messages.map(message => message.content).join('\\n'),
          model: input.model ?? 'fake-chat',
          providerId: 'fake',
          usage: { totalTokens: 3 }
        };
      }
    };

    const embedding: KnowledgeEmbeddingProvider = {
      providerId: 'fake',
      defaultModel: 'fake-embedding',
      dimensions: 3,
      async embedText() {
        return { embedding: [0.1, 0.2, 0.3], model: 'fake-embedding', dimensions: 3 };
      },
      async embedBatch(input) {
        return {
          embeddings: input.texts.map(() => [0.1, 0.2, 0.3]),
          model: 'fake-embedding',
          dimensions: 3
        };
      }
    };

    await expect(chat.generate({ messages: [{ role: 'user', content: 'hello' }] })).resolves.toMatchObject({
      text: 'hello'
    });
    await expect(embedding.embedText({ text: 'hello' })).resolves.toMatchObject({ dimensions: 3 });
  });

  it('projects provider errors through a stable SDK error', () => {
    const error = new KnowledgeProviderError('Provider timeout', {
      providerId: 'minimax',
      code: 'knowledge_provider_timeout',
      retryable: true,
      details: { model: 'MiniMax-M2.7' },
      cause: new Error('socket timeout')
    });

    expect(error).toMatchObject({
      name: 'KnowledgeProviderError',
      category: 'provider',
      code: 'knowledge_provider_timeout',
      retryable: true,
      providerId: 'minimax'
    });
  });
});
```

- [ ] **Step 2: Run the provider contract test and verify it fails**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/provider-contracts.test.ts
```

Expected: FAIL because schemas, provider interfaces, and `KnowledgeProviderError` do not exist.

- [ ] **Step 3: Add schema-first model profile contracts**

Append to `packages/knowledge/src/core/schemas/index.ts`:

```ts
export const KnowledgeModelAdapterSchema = z.union([
  z.literal('langchain-chat-openai'),
  z.literal('langchain-openai-embeddings'),
  z.literal('openai-compatible'),
  z.string().min(1)
]);

export const KnowledgeModelBindingSchema = z
  .object({
    providerId: z.string().min(1),
    adapter: KnowledgeModelAdapterSchema,
    model: z.string().min(1),
    baseUrl: z.string().url().optional(),
    dimensions: z.number().int().positive().optional()
  })
  .strict();

export const KnowledgeRerankModelBindingSchema = KnowledgeModelBindingSchema.extend({
  enabled: z.boolean()
}).strict();

export const KnowledgeModelProfileSchema = z
  .object({
    embedding: KnowledgeModelBindingSchema,
    chat: KnowledgeModelBindingSchema,
    rerank: KnowledgeRerankModelBindingSchema.optional(),
    judge: KnowledgeModelBindingSchema.optional()
  })
  .strict();
```

- [ ] **Step 4: Export inferred provider model types**

Add imports and exports in `packages/knowledge/src/core/types/index.ts`:

```ts
import type {
  KnowledgeModelAdapterSchema,
  KnowledgeModelBindingSchema,
  KnowledgeModelProfileSchema,
  KnowledgeRerankModelBindingSchema
} from '../schemas';

export type KnowledgeModelAdapter = z.infer<typeof KnowledgeModelAdapterSchema>;
export type KnowledgeModelBinding = z.infer<typeof KnowledgeModelBindingSchema>;
export type KnowledgeRerankModelBinding = z.infer<typeof KnowledgeRerankModelBindingSchema>;
export type KnowledgeModelProfile = z.infer<typeof KnowledgeModelProfileSchema>;
```

- [ ] **Step 5: Add provider interfaces**

Append to `packages/knowledge/src/core/interfaces/index.ts`:

```ts
import type { JsonObject, KnowledgeTokenUsage, ProviderHealth } from '../types';

export type KnowledgeChatRole = 'system' | 'user' | 'assistant';

export interface KnowledgeChatMessage {
  role: KnowledgeChatRole;
  content: string;
  name?: string;
  metadata?: JsonObject;
}

export interface KnowledgeChatInput {
  messages: KnowledgeChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: JsonObject;
}

export interface KnowledgeChatResult {
  text: string;
  providerId: string;
  model: string;
  usage?: KnowledgeTokenUsage;
  metadata?: JsonObject;
}

export type KnowledgeChatStreamEvent =
  | { type: 'delta'; text: string; metadata?: JsonObject }
  | { type: 'done'; result: KnowledgeChatResult }
  | { type: 'error'; error: string; metadata?: JsonObject };

export interface KnowledgeChatProvider {
  readonly providerId: string;
  readonly defaultModel: string;
  generate(input: KnowledgeChatInput): Promise<KnowledgeChatResult>;
  stream?(input: KnowledgeChatInput): AsyncIterable<KnowledgeChatStreamEvent>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface KnowledgeEmbeddingProvider {
  readonly providerId: string;
  readonly defaultModel: string;
  readonly dimensions?: number;
  embedText(input: EmbedTextInput): Promise<EmbedTextResult & { dimensions?: number }>;
  embedBatch(input: EmbedBatchInput): Promise<EmbedBatchResult & { dimensions?: number }>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface KnowledgeRerankInput {
  query: string;
  documents: Array<{ id: string; text: string; metadata?: JsonObject }>;
  model?: string;
  topK?: number;
}

export interface KnowledgeRerankResult {
  rankings: Array<{ id: string; score: number; rank: number }>;
  providerId: string;
  model: string;
  usage?: KnowledgeTokenUsage;
}

export interface KnowledgeRerankProvider {
  readonly providerId: string;
  rerank(input: KnowledgeRerankInput): Promise<KnowledgeRerankResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface KnowledgeJudgeInput {
  question: string;
  answer: string;
  citations?: Array<{ chunkId: string; text: string; score?: number }>;
  model?: string;
  metadata?: JsonObject;
}

export interface KnowledgeJudgeResult {
  score: number;
  reasons: string[];
  providerId: string;
  model: string;
  usage?: KnowledgeTokenUsage;
}

export interface KnowledgeJudgeProvider {
  readonly providerId: string;
  judge(input: KnowledgeJudgeInput): Promise<KnowledgeJudgeResult>;
  healthCheck?(): Promise<ProviderHealth>;
}
```

- [ ] **Step 6: Add `KnowledgeProviderError`**

Append to `packages/knowledge/src/core/errors/index.ts`:

```ts
export interface KnowledgeProviderErrorOptions extends Omit<KnowledgeErrorOptions, 'category'> {
  providerId: string;
}

export class KnowledgeProviderError extends KnowledgeError {
  readonly providerId: string;

  constructor(message: string, options: KnowledgeProviderErrorOptions) {
    super(message, { ...options, category: 'provider' });
    this.name = 'KnowledgeProviderError';
    this.providerId = options.providerId;
  }
}
```

- [ ] **Step 7: Verify the provider contract test passes**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/provider-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add packages/knowledge/src/core packages/knowledge/test/provider-contracts.test.ts
git commit -m "feat: add knowledge provider contracts"
```

## Task 3: Implement LangChain Chat And Embedding Wrappers

**Files:**

- Create: `packages/knowledge/src/adapters/shared/provider-errors.ts`
- Create: `packages/knowledge/src/adapters/shared/langchain-message.ts`
- Create: `packages/knowledge/src/adapters/shared/langchain-usage.ts`
- Create: `packages/knowledge/src/adapters/shared/index.ts`
- Create: `packages/knowledge/src/adapters/langchain/chat/langchain-chat-provider.ts`
- Create: `packages/knowledge/src/adapters/langchain/embeddings/langchain-embedding-provider.ts`
- Modify: `packages/knowledge/src/adapters/langchain/chat/index.ts`
- Modify: `packages/knowledge/src/adapters/langchain/embeddings/index.ts`
- Test: `packages/knowledge/test/langchain-adapters.test.ts`

- [ ] **Step 1: Write the failing wrapper tests**

Create `packages/knowledge/test/langchain-adapters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { LangChainChatProvider, LangChainEmbeddingProvider } from '../src/adapters/langchain';
import { KnowledgeProviderError } from '../src/core';

describe('LangChain knowledge adapters', () => {
  it('maps LangChain chat invoke results into KnowledgeChatResult', async () => {
    const provider = new LangChainChatProvider({
      providerId: 'minimax',
      defaultModel: 'MiniMax-M2.7',
      model: {
        async invoke(messages: unknown[]) {
          return {
            content: `answer:${messages.length}`,
            response_metadata: {
              tokenUsage: {
                promptTokens: 10,
                completionTokens: 4,
                totalTokens: 14
              }
            }
          };
        }
      }
    });

    await expect(
      provider.generate({
        messages: [
          { role: 'system', content: 'answer with citations' },
          { role: 'user', content: 'hello' }
        ],
        model: 'MiniMax-M2.7'
      })
    ).resolves.toEqual({
      text: 'answer:2',
      providerId: 'minimax',
      model: 'MiniMax-M2.7',
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        totalTokens: 14
      }
    });
  });

  it('converts LangChain chat errors to KnowledgeProviderError', async () => {
    const provider = new LangChainChatProvider({
      providerId: 'minimax',
      defaultModel: 'MiniMax-M2.7',
      model: {
        async invoke() {
          throw new Error('upstream timeout');
        }
      }
    });

    await expect(provider.generate({ messages: [{ role: 'user', content: 'hello' }] })).rejects.toMatchObject({
      name: 'KnowledgeProviderError',
      providerId: 'minimax',
      code: 'knowledge_provider_call_failed'
    });
  });

  it('maps LangChain embeddings into KnowledgeEmbeddingProvider results', async () => {
    const provider = new LangChainEmbeddingProvider({
      providerId: 'minimax',
      defaultModel: 'embedding',
      dimensions: 3,
      embeddings: {
        async embedQuery(text: string) {
          return [text.length, 0, 1];
        },
        async embedDocuments(texts: string[]) {
          return texts.map(text => [text.length, 0, 1]);
        }
      }
    });

    await expect(provider.embedText({ text: 'abcd' })).resolves.toEqual({
      embedding: [4, 0, 1],
      model: 'embedding',
      dimensions: 3
    });
    await expect(provider.embedBatch({ texts: ['a', 'ab'] })).resolves.toEqual({
      embeddings: [
        [1, 0, 1],
        [2, 0, 1]
      ],
      model: 'embedding',
      dimensions: 3
    });
  });

  it('rejects embedding count and dimension mismatches', async () => {
    const countMismatch = new LangChainEmbeddingProvider({
      providerId: 'minimax',
      defaultModel: 'embedding',
      dimensions: 3,
      embeddings: {
        async embedQuery() {
          return [1, 2, 3];
        },
        async embedDocuments() {
          return [[1, 2, 3]];
        }
      }
    });

    await expect(countMismatch.embedBatch({ texts: ['a', 'b'] })).rejects.toBeInstanceOf(KnowledgeProviderError);

    const dimensionMismatch = new LangChainEmbeddingProvider({
      providerId: 'minimax',
      defaultModel: 'embedding',
      dimensions: 3,
      embeddings: {
        async embedQuery() {
          return [1, 2];
        },
        async embedDocuments(texts: string[]) {
          return texts.map(() => [1, 2]);
        }
      }
    });

    await expect(dimensionMismatch.embedText({ text: 'a' })).rejects.toMatchObject({
      code: 'knowledge_embedding_dimensions_mismatch'
    });
  });
});
```

- [ ] **Step 2: Run the wrapper tests and verify they fail**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/langchain-adapters.test.ts
```

Expected: FAIL because wrapper classes are not implemented.

- [ ] **Step 3: Add shared adapter helpers**

Create `packages/knowledge/src/adapters/shared/provider-errors.ts`:

```ts
import { KnowledgeProviderError, type JsonObject } from '../../core';

export function toKnowledgeProviderError(input: {
  providerId: string;
  message: string;
  code?: string;
  retryable?: boolean;
  details?: JsonObject;
  cause?: unknown;
}): KnowledgeProviderError {
  return new KnowledgeProviderError(input.message, {
    providerId: input.providerId,
    code: input.code ?? 'knowledge_provider_call_failed',
    retryable: input.retryable ?? false,
    details: input.details,
    cause: input.cause
  });
}
```

Create `packages/knowledge/src/adapters/shared/langchain-message.ts`:

```ts
import type { KnowledgeChatMessage } from '../../core';

export interface LangChainMessageLike {
  role: string;
  content: string;
  name?: string;
}

export function toLangChainMessages(messages: readonly KnowledgeChatMessage[]): LangChainMessageLike[] {
  return messages.map(message => ({
    role: message.role,
    content: message.content,
    name: message.name
  }));
}

export function extractLangChainText(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }

  if (!isRecord(result)) {
    return '';
  }

  const content = result.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }
        if (isRecord(item) && typeof item.text === 'string') {
          return item.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('');
  }

  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

Create `packages/knowledge/src/adapters/shared/langchain-usage.ts`:

```ts
import type { KnowledgeTokenUsage } from '../../core';

export function extractLangChainUsage(result: unknown): KnowledgeTokenUsage | undefined {
  if (!isRecord(result)) {
    return undefined;
  }

  const metadata = isRecord(result.response_metadata) ? result.response_metadata : {};
  const usage = firstRecord(
    metadata.tokenUsage,
    metadata.usage,
    metadata.usage_metadata,
    result.usage_metadata,
    result.usage
  );

  if (!usage) {
    return undefined;
  }

  const inputTokens = readNumber(usage.input_tokens, usage.promptTokens, usage.prompt_tokens);
  const outputTokens = readNumber(usage.output_tokens, usage.completionTokens, usage.completion_tokens);
  const totalTokens = readNumber(usage.total_tokens, usage.totalTokens);

  const projected: KnowledgeTokenUsage = {};
  if (inputTokens !== undefined) projected.inputTokens = inputTokens;
  if (outputTokens !== undefined) projected.outputTokens = outputTokens;
  if (totalTokens !== undefined) projected.totalTokens = totalTokens;

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

function readNumber(...values: unknown[]): number | undefined {
  const value = values.find(item => typeof item === 'number' && Number.isFinite(item));
  return typeof value === 'number' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

Create `packages/knowledge/src/adapters/shared/index.ts`:

```ts
export * from './provider-errors';
export * from './langchain-message';
export * from './langchain-usage';
```

- [ ] **Step 4: Implement `LangChainChatProvider`**

Create `packages/knowledge/src/adapters/langchain/chat/langchain-chat-provider.ts`:

```ts
import type { KnowledgeChatInput, KnowledgeChatProvider, KnowledgeChatResult } from '../../../core';
import {
  extractLangChainText,
  extractLangChainUsage,
  toKnowledgeProviderError,
  toLangChainMessages
} from '../../shared';

export interface LangChainChatModelLike {
  invoke(messages: unknown[], options?: Record<string, unknown>): Promise<unknown>;
}

export interface LangChainChatProviderOptions {
  providerId: string;
  defaultModel: string;
  model: LangChainChatModelLike;
}

export class LangChainChatProvider implements KnowledgeChatProvider {
  readonly providerId: string;
  readonly defaultModel: string;
  private readonly model: LangChainChatModelLike;

  constructor(options: LangChainChatProviderOptions) {
    this.providerId = options.providerId;
    this.defaultModel = options.defaultModel;
    this.model = options.model;
  }

  async generate(input: KnowledgeChatInput): Promise<KnowledgeChatResult> {
    const model = input.model ?? this.defaultModel;

    try {
      const result = await this.model.invoke(toLangChainMessages(input.messages), {
        temperature: input.temperature,
        maxTokens: input.maxTokens
      });
      const text = extractLangChainText(result);

      return {
        text,
        providerId: this.providerId,
        model,
        usage: extractLangChainUsage(result)
      };
    } catch (error) {
      throw toKnowledgeProviderError({
        providerId: this.providerId,
        message: `Knowledge chat provider ${this.providerId} failed`,
        cause: error
      });
    }
  }
}
```

Update `packages/knowledge/src/adapters/langchain/chat/index.ts`:

```ts
export * from './langchain-chat-provider';
export * from './chat-openai-provider';
```

- [ ] **Step 5: Implement `LangChainEmbeddingProvider`**

Create `packages/knowledge/src/adapters/langchain/embeddings/langchain-embedding-provider.ts`:

```ts
import type {
  EmbedBatchInput,
  EmbedBatchResult,
  EmbedTextInput,
  EmbedTextResult,
  KnowledgeEmbeddingProvider
} from '../../../core';
import { toKnowledgeProviderError } from '../../shared';

export interface LangChainEmbeddingsLike {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

export interface LangChainEmbeddingProviderOptions {
  providerId: string;
  defaultModel: string;
  dimensions?: number;
  embeddings: LangChainEmbeddingsLike;
}

export class LangChainEmbeddingProvider implements KnowledgeEmbeddingProvider {
  readonly providerId: string;
  readonly defaultModel: string;
  readonly dimensions?: number;
  private readonly embeddings: LangChainEmbeddingsLike;

  constructor(options: LangChainEmbeddingProviderOptions) {
    this.providerId = options.providerId;
    this.defaultModel = options.defaultModel;
    this.dimensions = options.dimensions;
    this.embeddings = options.embeddings;
  }

  async embedText(input: EmbedTextInput): Promise<EmbedTextResult & { dimensions?: number }> {
    try {
      const embedding = await this.embeddings.embedQuery(input.text);
      this.assertDimensions(embedding);
      return { embedding, model: this.defaultModel, dimensions: embedding.length };
    } catch (error) {
      throw this.toEmbeddingError(error);
    }
  }

  async embedBatch(input: EmbedBatchInput): Promise<EmbedBatchResult & { dimensions?: number }> {
    try {
      const embeddings = await this.embeddings.embedDocuments(input.texts);
      if (embeddings.length !== input.texts.length) {
        throw toKnowledgeProviderError({
          providerId: this.providerId,
          message: 'Embedding count does not match input text count',
          code: 'knowledge_embedding_count_mismatch',
          details: { expected: input.texts.length, actual: embeddings.length }
        });
      }
      for (const embedding of embeddings) {
        this.assertDimensions(embedding);
      }
      return { embeddings, model: this.defaultModel, dimensions: embeddings[0]?.length ?? this.dimensions };
    } catch (error) {
      throw this.toEmbeddingError(error);
    }
  }

  private assertDimensions(embedding: readonly number[]) {
    if (this.dimensions !== undefined && embedding.length !== this.dimensions) {
      throw toKnowledgeProviderError({
        providerId: this.providerId,
        message: `Embedding dimensions mismatch for provider ${this.providerId}`,
        code: 'knowledge_embedding_dimensions_mismatch',
        details: { expected: this.dimensions, actual: embedding.length }
      });
    }
  }

  private toEmbeddingError(error: unknown) {
    if (error instanceof Error && error.name === 'KnowledgeProviderError') {
      return error;
    }
    return toKnowledgeProviderError({
      providerId: this.providerId,
      message: `Knowledge embedding provider ${this.providerId} failed`,
      cause: error
    });
  }
}
```

Update `packages/knowledge/src/adapters/langchain/embeddings/index.ts`:

```ts
export * from './langchain-embedding-provider';
export * from './openai-embeddings-provider';
```

- [ ] **Step 6: Verify wrapper tests pass**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/langchain-adapters.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/knowledge/src/adapters packages/knowledge/test/langchain-adapters.test.ts
git commit -m "feat: add langchain knowledge adapters"
```

## Task 4: Implement ChatOpenAI And Embedding Factory Presets

**Files:**

- Create: `packages/knowledge/src/adapters/langchain/chat/chat-openai-provider.ts`
- Create: `packages/knowledge/src/adapters/langchain/embeddings/openai-embeddings-provider.ts`
- Create: `packages/knowledge/src/adapters/openai-compatible/openai-compatible-chat-openai.ts`
- Create: `packages/knowledge/src/adapters/openai-compatible/openai-compatible-embeddings.ts`
- Create: `packages/knowledge/src/adapters/minimax/minimax-chat-openai.ts`
- Create: `packages/knowledge/src/adapters/minimax/minimax-embeddings-openai.ts`
- Create: `packages/knowledge/src/adapters/glm/glm-chat-openai.ts`
- Create: `packages/knowledge/src/adapters/glm/glm-embeddings-openai.ts`
- Create: `packages/knowledge/src/adapters/deepseek/deepseek-chat-openai.ts`
- Modify: vendor adapter `index.ts` files
- Test: `packages/knowledge/test/provider-presets.test.ts`

- [ ] **Step 1: Write the failing preset tests**

Create `packages/knowledge/test/provider-presets.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createdChatModels: unknown[] = [];
const createdEmbeddings: unknown[] = [];

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: class {
    constructor(options: unknown) {
      createdChatModels.push(options);
    }

    async invoke() {
      return { content: 'ok' };
    }
  },
  OpenAIEmbeddings: class {
    constructor(options: unknown) {
      createdEmbeddings.push(options);
    }

    async embedQuery() {
      return [1, 2, 3];
    }

    async embedDocuments(texts: string[]) {
      return texts.map(() => [1, 2, 3]);
    }
  }
}));

describe('knowledge provider presets', () => {
  beforeEach(() => {
    createdChatModels.length = 0;
    createdEmbeddings.length = 0;
  });

  it('creates MiniMax chat and embedding providers with ChatOpenAI-compatible settings', async () => {
    const { createMiniMaxChatProvider, createMiniMaxEmbeddingProvider } = await import('../src/adapters/minimax');

    const chat = createMiniMaxChatProvider({ apiKey: 'key', model: 'MiniMax-M2.7' });
    const embedding = createMiniMaxEmbeddingProvider({
      apiKey: 'key',
      model: 'minimax-embedding',
      dimensions: 3
    });

    expect(chat).toMatchObject({ providerId: 'minimax', defaultModel: 'MiniMax-M2.7' });
    expect(embedding).toMatchObject({ providerId: 'minimax', defaultModel: 'minimax-embedding', dimensions: 3 });
    expect(createdChatModels[0]).toMatchObject({
      model: 'MiniMax-M2.7',
      apiKey: 'key',
      configuration: { baseURL: 'https://api.minimaxi.com/v1' }
    });
    expect(createdEmbeddings[0]).toMatchObject({
      model: 'minimax-embedding',
      apiKey: 'key',
      dimensions: 3,
      configuration: { baseURL: 'https://api.minimaxi.com/v1' }
    });
  });

  it('creates GLM, DeepSeek, and OpenAI-compatible presets', async () => {
    const { createGlmChatProvider, createGlmEmbeddingProvider } = await import('../src/adapters/glm');
    const { createDeepSeekChatProvider } = await import('../src/adapters/deepseek');
    const { createOpenAICompatibleChatProvider } = await import('../src/adapters/openai-compatible');

    createGlmChatProvider({ apiKey: 'glm-key', model: 'glm-4.6' });
    createGlmEmbeddingProvider({ apiKey: 'glm-key', model: 'embedding-3', dimensions: 3 });
    createDeepSeekChatProvider({ apiKey: 'deepseek-key', model: 'deepseek-chat' });
    createOpenAICompatibleChatProvider({
      providerId: 'custom',
      apiKey: 'custom-key',
      baseUrl: 'https://example.com/v1',
      model: 'custom-chat'
    });

    expect(createdChatModels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: 'glm-4.6' }),
        expect.objectContaining({ model: 'deepseek-chat' }),
        expect.objectContaining({ model: 'custom-chat', configuration: { baseURL: 'https://example.com/v1' } })
      ])
    );
    expect(createdEmbeddings).toEqual(expect.arrayContaining([expect.objectContaining({ model: 'embedding-3' })]));
  });
});
```

- [ ] **Step 2: Run the preset tests and verify they fail**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/provider-presets.test.ts
```

Expected: FAIL because preset factories are not implemented.

- [ ] **Step 3: Implement base ChatOpenAI and OpenAIEmbeddings factories**

Create `packages/knowledge/src/adapters/langchain/chat/chat-openai-provider.ts`:

```ts
import { ChatOpenAI } from '@langchain/openai';

import { LangChainChatProvider } from './langchain-chat-provider';

export interface ChatOpenAIKnowledgeProviderOptions {
  providerId: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export function createChatOpenAIProvider(options: ChatOpenAIKnowledgeProviderOptions): LangChainChatProvider {
  return new LangChainChatProvider({
    providerId: options.providerId,
    defaultModel: options.model,
    model: new ChatOpenAI({
      model: options.model,
      apiKey: options.apiKey,
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens,
      configuration: options.baseUrl ? { baseURL: options.baseUrl } : undefined
    })
  });
}
```

Create `packages/knowledge/src/adapters/langchain/embeddings/openai-embeddings-provider.ts`:

```ts
import { OpenAIEmbeddings } from '@langchain/openai';

import { LangChainEmbeddingProvider } from './langchain-embedding-provider';

export interface OpenAIEmbeddingsKnowledgeProviderOptions {
  providerId: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  dimensions?: number;
  batchSize?: number;
}

export function createOpenAIEmbeddingsProvider(
  options: OpenAIEmbeddingsKnowledgeProviderOptions
): LangChainEmbeddingProvider {
  return new LangChainEmbeddingProvider({
    providerId: options.providerId,
    defaultModel: options.model,
    dimensions: options.dimensions,
    embeddings: new OpenAIEmbeddings({
      model: options.model,
      apiKey: options.apiKey,
      dimensions: options.dimensions,
      batchSize: Math.max(1, options.batchSize ?? 16),
      encodingFormat: 'float',
      configuration: options.baseUrl ? { baseURL: options.baseUrl } : undefined
    })
  });
}
```

- [ ] **Step 4: Implement OpenAI-compatible presets**

Create `packages/knowledge/src/adapters/openai-compatible/openai-compatible-chat-openai.ts`:

```ts
import { createChatOpenAIProvider, type ChatOpenAIKnowledgeProviderOptions } from '../langchain/chat';

export type OpenAICompatibleChatProviderOptions = ChatOpenAIKnowledgeProviderOptions;

export function createOpenAICompatibleChatProvider(options: OpenAICompatibleChatProviderOptions) {
  return createChatOpenAIProvider(options);
}
```

Create `packages/knowledge/src/adapters/openai-compatible/openai-compatible-embeddings.ts`:

```ts
import { createOpenAIEmbeddingsProvider, type OpenAIEmbeddingsKnowledgeProviderOptions } from '../langchain/embeddings';

export type OpenAICompatibleEmbeddingProviderOptions = OpenAIEmbeddingsKnowledgeProviderOptions;

export function createOpenAICompatibleEmbeddingProvider(options: OpenAICompatibleEmbeddingProviderOptions) {
  return createOpenAIEmbeddingsProvider(options);
}
```

Update `packages/knowledge/src/adapters/openai-compatible/index.ts`:

```ts
export * from './openai-compatible-chat-openai';
export * from './openai-compatible-embeddings';
```

- [ ] **Step 5: Implement vendor presets**

Create `packages/knowledge/src/adapters/minimax/minimax-chat-openai.ts`:

```ts
import { createChatOpenAIProvider } from '../langchain/chat';

export interface MiniMaxChatProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function createMiniMaxChatProvider(options: MiniMaxChatProviderOptions) {
  return createChatOpenAIProvider({
    providerId: 'minimax',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://api.minimaxi.com/v1',
    temperature: options.temperature,
    maxTokens: options.maxTokens
  });
}
```

Create `packages/knowledge/src/adapters/minimax/minimax-embeddings-openai.ts`:

```ts
import { createOpenAIEmbeddingsProvider } from '../langchain/embeddings';

export interface MiniMaxEmbeddingProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  dimensions?: number;
  batchSize?: number;
}

export function createMiniMaxEmbeddingProvider(options: MiniMaxEmbeddingProviderOptions) {
  return createOpenAIEmbeddingsProvider({
    providerId: 'minimax',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://api.minimaxi.com/v1',
    dimensions: options.dimensions,
    batchSize: options.batchSize
  });
}
```

Update `packages/knowledge/src/adapters/minimax/index.ts`:

```ts
export * from './minimax-chat-openai';
export * from './minimax-embeddings-openai';
```

Create `packages/knowledge/src/adapters/glm/glm-chat-openai.ts`:

```ts
import { createChatOpenAIProvider } from '../langchain/chat';

export interface GlmChatProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function createGlmChatProvider(options: GlmChatProviderOptions) {
  return createChatOpenAIProvider({
    providerId: 'glm',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4',
    temperature: options.temperature,
    maxTokens: options.maxTokens
  });
}
```

Create `packages/knowledge/src/adapters/glm/glm-embeddings-openai.ts`:

```ts
import { createOpenAIEmbeddingsProvider } from '../langchain/embeddings';

export interface GlmEmbeddingProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  dimensions?: number;
  batchSize?: number;
}

export function createGlmEmbeddingProvider(options: GlmEmbeddingProviderOptions) {
  return createOpenAIEmbeddingsProvider({
    providerId: 'glm',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://open.bigmodel.cn/api/paas/v4',
    dimensions: options.dimensions,
    batchSize: options.batchSize
  });
}
```

Update `packages/knowledge/src/adapters/glm/index.ts`:

```ts
export * from './glm-chat-openai';
export * from './glm-embeddings-openai';
```

Create `packages/knowledge/src/adapters/deepseek/deepseek-chat-openai.ts`:

```ts
import { createChatOpenAIProvider } from '../langchain/chat';

export interface DeepSeekChatProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function createDeepSeekChatProvider(options: DeepSeekChatProviderOptions) {
  return createChatOpenAIProvider({
    providerId: 'deepseek',
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? 'https://api.deepseek.com/v1',
    temperature: options.temperature,
    maxTokens: options.maxTokens
  });
}
```

Update `packages/knowledge/src/adapters/deepseek/index.ts`:

```ts
export * from './deepseek-chat-openai';
```

- [ ] **Step 6: Verify preset tests pass**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/provider-presets.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/knowledge/src/adapters packages/knowledge/test/provider-presets.test.ts
git commit -m "feat: add knowledge provider presets"
```

## Task 5: Finalize Root Exports, Docs, And Verification

**Files:**

- Modify: `packages/knowledge/src/index.ts`
- Modify: `docs/sdk/knowledge.md`
- Modify: `docs/packages/knowledge/README.md`
- Test: `packages/knowledge/test/sdk-entrypoints.test.ts`

- [ ] **Step 1: Add root adapter export assertions**

Append to `packages/knowledge/test/sdk-entrypoints.test.ts`:

```ts
describe('knowledge root adapter exports', () => {
  it('exports adapter factories from the root entrypoint for SDK discoverability', async () => {
    const root = await import('../src');

    expect(root).toHaveProperty('createMiniMaxChatProvider');
    expect(root).toHaveProperty('createGlmEmbeddingProvider');
    expect(root).toHaveProperty('createDeepSeekChatProvider');
    expect(root).toHaveProperty('LangChainEmbeddingProvider');
  });
});
```

- [ ] **Step 2: Run the root export test and verify it fails**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/sdk-entrypoints.test.ts
```

Expected: FAIL because the root entrypoint does not export adapters yet.

- [ ] **Step 3: Export adapters from the SDK root**

Append to `packages/knowledge/src/index.ts`:

```ts
export * from './adapters';
```

- [ ] **Step 4: Update SDK documentation**

Add this section to `docs/sdk/knowledge.md` after “默认实现”:

````md
## 官方 Adapter 层

`@agent/knowledge` 发布包包含官方 adapter 子路径：

- `@agent/knowledge/adapters`
- `@agent/knowledge/adapters/langchain`
- `@agent/knowledge/adapters/minimax`
- `@agent/knowledge/adapters/glm`
- `@agent/knowledge/adapters/deepseek`
- `@agent/knowledge/adapters/openai-compatible`

默认厂商模型通过 `@langchain/openai` 创建。MiniMax 是默认推荐 provider；GLM、DeepSeek 与 OpenAI-compatible 作为可选接入。

```ts
import { createMiniMaxChatProvider, createMiniMaxEmbeddingProvider } from '@agent/knowledge/adapters/minimax';

const chatProvider = createMiniMaxChatProvider({
  apiKey: process.env.MINIMAX_API_KEY,
  model: 'MiniMax-M2.7'
});

const embeddingProvider = createMiniMaxEmbeddingProvider({
  apiKey: process.env.MINIMAX_API_KEY,
  model: 'minimax-embedding',
  dimensions: 1536
});
```
````

Adapter 只返回 Knowledge SDK 自己的 provider contract。LangChain message、usage metadata、vendor response、raw headers 和 provider error 不会穿透到 `core` schema、API DTO、trace 或数据库记录。

````

- [ ] **Step 5: Update package README index**

Add this bullet to `docs/packages/knowledge/README.md` under “当前实现补充”:

```md
- `packages/knowledge/src/adapters/`
  - 是 `@agent/knowledge` 独立发布包内的官方 adapter 层
  - 通过 LangChain `ChatOpenAI` / `OpenAIEmbeddings` 创建 MiniMax、GLM、DeepSeek 与 OpenAI-compatible provider
  - 对外只暴露 `KnowledgeChatProvider` / `KnowledgeEmbeddingProvider` 等 SDK contract，不泄露 LangChain 或 vendor 原始对象
````

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/provider-contracts.test.ts test/langchain-adapters.test.ts test/provider-presets.test.ts test/sdk-entrypoints.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm check:docs
```

Expected: all commands PASS.

- [ ] **Step 7: Build the package**

Run:

```bash
pnpm --dir packages/knowledge build:lib
```

Expected: PASS and build outputs include adapter entrypoints under `build/cjs/adapters` and `build/esm/adapters`.

- [ ] **Step 8: Commit**

Run:

```bash
git add packages/knowledge/src/index.ts packages/knowledge/test/sdk-entrypoints.test.ts docs/sdk/knowledge.md docs/packages/knowledge/README.md
git commit -m "docs: document knowledge provider adapters"
```

## Completion Criteria

- `packages/knowledge` exposes SDK provider contracts for chat, embedding, rerank, and judge providers.
- `packages/knowledge/src/adapters` exists and includes LangChain wrappers plus MiniMax, GLM, DeepSeek, and OpenAI-compatible presets.
- MiniMax chat and embedding providers are available as the default SDK adapter path.
- Adapter subpaths build through tsup and package exports.
- LangChain and vendor raw objects do not appear in `core` schemas or public DTOs.
- Focused Vitest, TypeScript, docs check, and package build pass.

## Follow-Up Plans

After this plan lands, create separate plans for:

- Backend provider profile resolution and injection into `KnowledgeIngestionService` / `KnowledgeRagService`.
- Ingestion metadata, embedding dimension compatibility, and `needsReindex` persistence.
- Frontend workspace default model settings, knowledge base override UI, provider health display, and trace provider/model projection.
