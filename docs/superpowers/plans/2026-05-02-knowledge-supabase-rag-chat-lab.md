# Knowledge Supabase RAG Chat Lab Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-02

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production Knowledge RAG vertical slice with Supabase PostgreSQL + pgvector as the canonical store, SDK default providers in the backend, and a Codex-style Chat Lab that talks to a real LLM-backed RAG API.

**Architecture:** `@agent/knowledge` owns stable SDK provider contracts, default runtime factory, and Supabase pgvector adapter boundaries. `knowledge-server` owns auth, membership, upload, ingestion, chat API, and server-side SDK wiring. `apps/frontend/knowledge` owns only Codex-style conversation UI and stable HTTP API consumption.

**Tech Stack:** TypeScript, zod, NestJS, React, Ant Design, Vitest, Supabase PostgreSQL + pgvector, `@agent/knowledge` adapters.

---

## Scope Check

This is a single vertical product slice even though it touches SDK, backend, frontend, and docs. Each task produces testable software on its own and keeps ownership serialized in the current checkout. Do not use `git worktree`.

## File Structure Map

- `packages/knowledge/src/node/knowledge-sdk-runtime.ts`: creates the server-side default Knowledge SDK runtime bundle.
- `packages/knowledge/src/node/index.ts`: exports Node-only SDK runtime factory.
- `packages/knowledge/test/sdk-default-runtime.test.ts`: verifies env parsing, provider creation, missing config errors, and no browser leakage.
- `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts`: canonical Supabase/Postgres SQL and pgvector RPC definitions.
- `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-sdk-runtime.provider.ts`: Nest provider that creates the SDK runtime from environment.
- `apps/backend/knowledge-server/src/knowledge/knowledge.tokens.ts`: injection token for the SDK runtime.
- `apps/backend/knowledge-server/src/knowledge/knowledge-ingestion.worker.ts`: real parse/chunk/embed/vector upsert job pipeline.
- `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`: real vector retrieval + chat generation for `/api/chat`.
- `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts`: Chat response display fields and safe citation/step contracts.
- `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`: TypeScript DTOs matching schemas.
- `apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts`: ingestion success/failure tests.
- `apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts`: chat RAG and error mapping tests.
- `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`: Codex-style Chat Lab shell and conversation view.
- `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-helpers.ts`: mention parsing, conversation state helpers, step formatting.
- `apps/frontend/knowledge/src/styles/knowledge-pro.css`: Codex-style layout and density rules.
- `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`: Chat Lab request/response rendering tests.
- `docs/packages/knowledge/sdk.md`: SDK usage guide.
- `docs/apps/backend/knowledge-server/knowledge-server.md`: backend integration guide.
- `docs/apps/frontend/knowledge/knowledge-frontend.md`: frontend Chat Lab behavior.
- `docs/contracts/api/knowledge.md`: stable `/chat`, citation, step, and error contracts.

---

### Task 1: SDK Default Runtime Bundle

**Files:**

- Create: `packages/knowledge/src/node/knowledge-sdk-runtime.ts`
- Modify: `packages/knowledge/src/node/index.ts`
- Test: `packages/knowledge/test/sdk-default-runtime.test.ts`

- [ ] **Step 1: Write the failing SDK runtime tests**

Create `packages/knowledge/test/sdk-default-runtime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultKnowledgeSdkRuntime, KnowledgeSdkRuntimeConfigError } from '../src/node';

function supabaseClient() {
  return {
    rpc: async () => ({ data: { upserted_count: 1 }, error: null })
  };
}

describe('createDefaultKnowledgeSdkRuntime', () => {
  it('creates default chat, embedding, and vector store providers from explicit config', () => {
    const runtime = createDefaultKnowledgeSdkRuntime({
      chat: { provider: 'openai-compatible', apiKey: 'chat-key', model: 'chat-model', baseURL: 'https://llm.local/v1' },
      embedding: {
        provider: 'openai-compatible',
        apiKey: 'embed-key',
        model: 'embed-model',
        baseURL: 'https://embed.local/v1',
        dimensions: 1536
      },
      vectorStore: { client: supabaseClient(), knowledgeBaseId: 'kb_default' }
    });

    expect(runtime.chatProvider.providerId).toBe('openai-compatible');
    expect(runtime.embeddingProvider.providerId).toBe('openai-compatible');
    expect(runtime.vectorStore).toBeTruthy();
  });

  it('fails fast when vector store client is missing', () => {
    expect(() =>
      createDefaultKnowledgeSdkRuntime({
        chat: {
          provider: 'openai-compatible',
          apiKey: 'chat-key',
          model: 'chat-model',
          baseURL: 'https://llm.local/v1'
        },
        embedding: {
          provider: 'openai-compatible',
          apiKey: 'embed-key',
          model: 'embed-model',
          baseURL: 'https://embed.local/v1',
          dimensions: 1536
        }
      })
    ).toThrow(KnowledgeSdkRuntimeConfigError);
  });
});
```

- [ ] **Step 2: Run the SDK runtime test and verify it fails**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/sdk-default-runtime.test.ts
```

Expected: FAIL because `createDefaultKnowledgeSdkRuntime` and `KnowledgeSdkRuntimeConfigError` are not exported.

- [ ] **Step 3: Implement the SDK runtime factory**

Create `packages/knowledge/src/node/knowledge-sdk-runtime.ts`:

```ts
import {
  createOpenAICompatibleChatProvider,
  createOpenAICompatibleEmbeddingProvider,
  SupabasePgVectorStoreAdapter,
  type SupabasePgVectorStoreAdapterOptions
} from '../adapters';
import type { KnowledgeChatProvider, KnowledgeEmbeddingProvider, KnowledgeSdkVectorStore } from '../core';

export type KnowledgeDefaultProviderId = 'openai-compatible' | 'minimax' | 'glm' | 'deepseek';

export class KnowledgeSdkRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeSdkRuntimeConfigError';
  }
}

export interface KnowledgeSdkProviderConfig {
  provider: KnowledgeDefaultProviderId;
  apiKey: string;
  model: string;
  baseURL?: string;
  dimensions?: number;
}

export interface KnowledgeSdkRuntimeConfig {
  chat: KnowledgeSdkProviderConfig;
  embedding: KnowledgeSdkProviderConfig;
  vectorStore?: SupabasePgVectorStoreAdapterOptions;
}

export interface KnowledgeSdkRuntime {
  chatProvider: KnowledgeChatProvider;
  embeddingProvider: KnowledgeEmbeddingProvider;
  vectorStore: KnowledgeSdkVectorStore;
}

export function createDefaultKnowledgeSdkRuntime(config: KnowledgeSdkRuntimeConfig): KnowledgeSdkRuntime {
  if (!config.vectorStore?.client) {
    throw new KnowledgeSdkRuntimeConfigError('Knowledge SDK runtime requires a Supabase pgvector RPC client.');
  }

  return {
    chatProvider: createChatProvider(config.chat),
    embeddingProvider: createEmbeddingProvider(config.embedding),
    vectorStore: new SupabasePgVectorStoreAdapter(config.vectorStore)
  };
}

function createChatProvider(config: KnowledgeSdkProviderConfig): KnowledgeChatProvider {
  if (config.provider !== 'openai-compatible') {
    throw new KnowledgeSdkRuntimeConfigError(`Unsupported default chat provider: ${config.provider}`);
  }
  return createOpenAICompatibleChatProvider({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    model: config.model
  });
}

function createEmbeddingProvider(config: KnowledgeSdkProviderConfig): KnowledgeEmbeddingProvider {
  if (config.provider !== 'openai-compatible') {
    throw new KnowledgeSdkRuntimeConfigError(`Unsupported default embedding provider: ${config.provider}`);
  }
  return createOpenAICompatibleEmbeddingProvider({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    dimensions: config.dimensions,
    model: config.model
  });
}
```

Update `packages/knowledge/src/node/index.ts`:

```ts
export * from './knowledge-sdk-runtime';
```

- [ ] **Step 4: Run SDK runtime verification**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/sdk-default-runtime.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add packages/knowledge/src/node/knowledge-sdk-runtime.ts packages/knowledge/src/node/index.ts packages/knowledge/test/sdk-default-runtime.test.ts
git commit -m "feat: add default knowledge sdk runtime"
```

---

### Task 2: Supabase pgvector SQL/RPC Contract

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-database.provider.test.ts`
- Docs: `docs/apps/backend/knowledge-server/knowledge-server.md`

- [ ] **Step 1: Write the failing schema test**

Add assertions to `apps/backend/knowledge-server/test/knowledge/knowledge-database.provider.test.ts`:

```ts
import { KNOWLEDGE_SCHEMA_SQL } from '../../src/knowledge/runtime/knowledge-schema.sql';

it('defines pgvector extension, embedding column, and vector RPC functions', () => {
  expect(KNOWLEDGE_SCHEMA_SQL).toContain('create extension if not exists vector');
  expect(KNOWLEDGE_SCHEMA_SQL).toContain('embedding vector(');
  expect(KNOWLEDGE_SCHEMA_SQL).toContain('create or replace function upsert_knowledge_chunks');
  expect(KNOWLEDGE_SCHEMA_SQL).toContain('create or replace function match_knowledge_chunks');
  expect(KNOWLEDGE_SCHEMA_SQL).toContain('create or replace function delete_knowledge_document_chunks');
});
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-database.provider.test.ts
```

Expected: FAIL because pgvector extension/RPC SQL is not present.

- [ ] **Step 3: Add pgvector SQL and RPC functions**

Update `KNOWLEDGE_SCHEMA_SQL` so `knowledge_document_chunks` stores the canonical vector:

```sql
create extension if not exists vector;

alter table knowledge_document_chunks
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists embedding vector(1536);

create or replace function upsert_knowledge_chunks(
  knowledge_base_id text,
  document_id text,
  records jsonb,
  tenant_id text default null
) returns jsonb
language plpgsql
as $$
declare
  record jsonb;
  upserted_count integer := 0;
begin
  for record in select * from jsonb_array_elements(records)
  loop
    insert into knowledge_document_chunks (
      id,
      document_id,
      ordinal,
      content,
      token_count,
      embedding_status,
      vector_index_status,
      keyword_index_status,
      metadata,
      embedding,
      created_at,
      updated_at
    )
    values (
      record->>'chunk_id',
      document_id,
      coalesce((record->>'ordinal')::integer, 0),
      record->>'text',
      coalesce((record->>'token_count')::integer, 0),
      'succeeded',
      'succeeded',
      'succeeded',
      coalesce(record->'metadata', '{}'::jsonb),
      (record->>'embedding')::vector,
      now(),
      now()
    )
    on conflict (id) do update set
      content = excluded.content,
      token_count = excluded.token_count,
      metadata = excluded.metadata,
      embedding = excluded.embedding,
      embedding_status = 'succeeded',
      vector_index_status = 'succeeded',
      updated_at = now();

    upserted_count := upserted_count + 1;
  end loop;

  return jsonb_build_object('upserted_count', upserted_count);
end;
$$;
```

Also add `match_knowledge_chunks` and `delete_knowledge_document_chunks` functions in the same file. Use `embedding <=> query_embedding` for similarity and return rows with `chunk_id`, `document_id`, `text`, `score`, and `metadata`.

- [ ] **Step 4: Run schema verification**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-database.provider.test.ts
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add apps/backend/knowledge-server/src/knowledge/runtime/knowledge-schema.sql.ts apps/backend/knowledge-server/test/knowledge/knowledge-database.provider.test.ts docs/apps/backend/knowledge-server/knowledge-server.md
git commit -m "feat: add knowledge pgvector schema contract"
```

---

### Task 3: Backend SDK Runtime Provider

**Files:**

- Create: `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-sdk-runtime.provider.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.tokens.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-repository-provider.test.ts`

- [ ] **Step 1: Write the failing Nest provider test**

Add to `apps/backend/knowledge-server/test/knowledge/knowledge-repository-provider.test.ts`:

```ts
import { KNOWLEDGE_SDK_RUNTIME } from '../../src/knowledge/knowledge.tokens';
import { createKnowledgeSdkRuntimeProvider } from '../../src/knowledge/runtime/knowledge-sdk-runtime.provider';

it('creates a runtime provider that fails fast without Supabase RPC config', async () => {
  const provider = createKnowledgeSdkRuntimeProvider({
    env: {
      KNOWLEDGE_CHAT_PROVIDER: 'openai-compatible',
      KNOWLEDGE_CHAT_MODEL: 'chat-model',
      KNOWLEDGE_CHAT_API_KEY: 'chat-key',
      KNOWLEDGE_EMBEDDING_PROVIDER: 'openai-compatible',
      KNOWLEDGE_EMBEDDING_MODEL_ID: 'embed-model',
      KNOWLEDGE_EMBEDDING_API_KEY: 'embed-key'
    }
  });

  expect(provider.provide).toBe(KNOWLEDGE_SDK_RUNTIME);
  await expect(provider.useFactory()).rejects.toThrow('Supabase pgvector');
});
```

- [ ] **Step 2: Run provider test and verify it fails**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-repository-provider.test.ts
```

Expected: FAIL because `KNOWLEDGE_SDK_RUNTIME` and provider factory do not exist.

- [ ] **Step 3: Implement the runtime provider**

Update `apps/backend/knowledge-server/src/knowledge/knowledge.tokens.ts`:

```ts
export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');
export const KNOWLEDGE_OSS_STORAGE = Symbol('KNOWLEDGE_OSS_STORAGE');
export const KNOWLEDGE_SDK_RUNTIME = Symbol('KNOWLEDGE_SDK_RUNTIME');
```

Create `apps/backend/knowledge-server/src/knowledge/runtime/knowledge-sdk-runtime.provider.ts`:

```ts
import type { Provider } from '@nestjs/common';
import { createDefaultKnowledgeSdkRuntime, type KnowledgeSdkRuntime } from '@agent/knowledge/node';
import { KNOWLEDGE_SDK_RUNTIME } from '../knowledge.tokens';

export interface KnowledgeSdkRuntimeProviderOptions {
  env?: NodeJS.ProcessEnv;
  rpcClient?: {
    rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown | null; error: unknown | null }>;
  };
}

export function createKnowledgeSdkRuntimeProvider(options: KnowledgeSdkRuntimeProviderOptions = {}): Provider {
  return {
    provide: KNOWLEDGE_SDK_RUNTIME,
    useFactory: async (): Promise<KnowledgeSdkRuntime> => {
      const env = options.env ?? process.env;
      if (!options.rpcClient) {
        throw new Error('Supabase pgvector RPC client is required for Knowledge SDK runtime.');
      }
      return createDefaultKnowledgeSdkRuntime({
        chat: {
          provider: 'openai-compatible',
          apiKey: requireEnv(env, 'KNOWLEDGE_CHAT_API_KEY'),
          baseURL: env.KNOWLEDGE_CHAT_BASE_URL,
          model: requireEnv(env, 'KNOWLEDGE_CHAT_MODEL')
        },
        embedding: {
          provider: 'openai-compatible',
          apiKey: requireEnv(env, 'KNOWLEDGE_EMBEDDING_API_KEY'),
          baseURL: env.KNOWLEDGE_EMBEDDING_BASE_URL,
          dimensions: Number(env.KNOWLEDGE_EMBEDDING_DIMENSIONS ?? 1536),
          model: requireEnv(env, 'KNOWLEDGE_EMBEDDING_MODEL_ID')
        },
        vectorStore: { client: options.rpcClient }
      });
    }
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required for Knowledge SDK runtime.`);
  }
  return value;
}
```

Wire the provider in `knowledge.module.ts` after the database/RPC client exists. Keep provider creation in the runtime folder and inject only `KNOWLEDGE_SDK_RUNTIME` into services.

- [ ] **Step 4: Run provider verification**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-repository-provider.test.ts
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add apps/backend/knowledge-server/src/knowledge/runtime/knowledge-sdk-runtime.provider.ts apps/backend/knowledge-server/src/knowledge/knowledge.tokens.ts apps/backend/knowledge-server/src/knowledge/knowledge.module.ts apps/backend/knowledge-server/test/knowledge/knowledge-repository-provider.test.ts
git commit -m "feat: wire knowledge sdk runtime provider"
```

---

### Task 4: Real Ingestion Worker Embed And Upsert

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-ingestion.worker.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.module.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts`

- [ ] **Step 1: Write failing ingestion tests**

Add tests to `apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts`:

```ts
it('embeds chunks and upserts vectors before marking the document ready', async () => {
  const runtime = createFakeKnowledgeRuntime({
    embeddings: [[0.1, 0.2, 0.3]],
    upsertedCount: 1
  });
  const { document, job } = await createUploadedDocument({ runtime, content: 'hello vector world' });

  expect(document.status).toBe('ready');
  expect(document.embeddedChunkCount).toBe(1);
  expect(job.stages.map(stage => stage.stage)).toEqual([
    'parse',
    'chunk',
    'embed',
    'index_vector',
    'index_keyword',
    'commit'
  ]);
  expect(runtime.vectorStore.upsert).toHaveBeenCalledWith({
    records: [
      expect.objectContaining({
        content: 'hello vector world',
        embedding: [0.1, 0.2, 0.3],
        metadata: expect.objectContaining({ documentId: document.id })
      })
    ]
  });
});

it('marks index_vector failed when vector upsert fails', async () => {
  const runtime = createFakeKnowledgeRuntime({ upsertError: new Error('dimension mismatch') });
  await expect(createUploadedDocument({ runtime, content: 'broken vector' })).rejects.toThrow('dimension mismatch');
});
```

- [ ] **Step 2: Run ingestion tests and verify they fail**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
```

Expected: FAIL because `KnowledgeIngestionWorker` marks chunks succeeded without calling SDK providers.

- [ ] **Step 3: Inject SDK runtime into the worker**

Update constructor:

```ts
constructor(
  private readonly repository: KnowledgeRepository,
  private readonly storage: OssStorageProvider,
  @Inject(KNOWLEDGE_SDK_RUNTIME) private readonly runtime: KnowledgeSdkRuntime
) {}
```

Import `Inject`, `KNOWLEDGE_SDK_RUNTIME`, and `KnowledgeSdkRuntime`.

- [ ] **Step 4: Implement embed and vector upsert**

Replace direct `embeddingStatus: 'succeeded'` assignment with:

```ts
const contents = chunks.map(chunk => chunk.content);
const embeddingResult = await this.runtime.embeddingProvider.embedBatch({
  texts: contents,
  metadata: { documentId: document.id, knowledgeBaseId: document.knowledgeBaseId }
});

const vectorRecords = chunks.map((chunk, index) => ({
  id: chunk.id,
  content: chunk.content,
  embedding: embeddingResult.embeddings[index]!,
  metadata: {
    documentId: document.id,
    knowledgeBaseId: document.knowledgeBaseId,
    ordinal: chunk.ordinal,
    title: document.title
  }
}));

const upsertResult = await this.runtime.vectorStore.upsert({ records: vectorRecords });
if (upsertResult.upsertedCount !== vectorRecords.length) {
  throw new KnowledgeServiceError('knowledge_vector_index_failed', '向量写入数量与 chunk 数量不一致');
}
```

Update job stage before and after `embed` and `index_vector`. Mark document ready only after upsert succeeds.

- [ ] **Step 5: Run ingestion verification**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add apps/backend/knowledge-server/src/knowledge/knowledge-ingestion.worker.ts apps/backend/knowledge-server/src/knowledge/knowledge.module.ts apps/backend/knowledge-server/test/knowledge/knowledge-document-ingestion.spec.ts
git commit -m "feat: index knowledge chunks into pgvector"
```

---

### Task 5: Real LLM-Backed Chat RAG

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.errors.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts`

- [ ] **Step 1: Write failing Chat RAG tests**

Add to `knowledge-frontend-mvp.controller.test.ts`:

```ts
it('uses query embedding, vector search, and chat generation for /chat', async () => {
  const runtime = createFakeKnowledgeRuntime({
    queryEmbedding: [0.2, 0.3, 0.4],
    vectorHits: [
      {
        id: 'chunk_1',
        score: 0.92,
        content: '默认使用 Supabase PostgreSQL + pgvector 存放知识库向量。',
        metadata: { documentId: 'doc_1', knowledgeBaseId: 'kb_1', title: 'SDK 文档' }
      }
    ],
    generatedText: '知识库向量应写入 Supabase PostgreSQL + pgvector。'
  });

  const response = await controller.chat(actor, {
    model: 'knowledge-rag',
    messages: [{ role: 'user', content: '知识库向量放在哪里？' }],
    metadata: { conversationId: 'conv_1' },
    stream: false
  });

  expect(response.answer).toBe('知识库向量应写入 Supabase PostgreSQL + pgvector。');
  expect(response.citations[0]).toMatchObject({ chunkId: 'chunk_1', score: 0.92 });
  expect(response.steps.map(step => step.stage)).toEqual(['route', 'embed', 'retrieve', 'generate']);
});
```

- [ ] **Step 2: Run Chat RAG tests and verify they fail**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts
```

Expected: FAIL because chat currently returns joined citation quotes and has no `steps`.

- [ ] **Step 3: Extend Chat response DTO**

Add schema/type fields:

```ts
export const KnowledgeChatStepSchema = z.object({
  stage: z.enum(['route', 'embed', 'retrieve', 'generate']),
  status: z.enum(['succeeded', 'failed']),
  durationMs: z.number().int().nonnegative(),
  summary: z.string()
});
```

Add `steps: KnowledgeChatStep[]`, `durationMs`, `knowledgeBaseIds`, and `model` to `KnowledgeChatResponse`.

- [ ] **Step 4: Implement vector retrieval and generation**

In `KnowledgeDocumentService.chat()`:

```ts
const queryEmbedding = await this.runtime.embeddingProvider.embedText({
  text: request.message,
  metadata: { conversationId, knowledgeBaseIds: targetBaseIds }
});

const vectorResult = await this.runtime.vectorStore.search({
  embedding: queryEmbedding.embedding,
  topK: 5,
  filters: { knowledgeBaseId: targetBaseIds[0], query: request.message }
});

const citations = vectorResult.hits.map((hit, index) => toChatCitation(hit, index));
const answer =
  citations.length === 0
    ? '未在当前知识库中找到足够依据。'
    : (
        await this.runtime.chatProvider.generate({
          model: input.model,
          messages: buildRagMessages(request.message, citations),
          metadata: { conversationId, knowledgeBaseIds: targetBaseIds }
        })
      ).text;
```

Keep `buildRagMessages()` local to the service or a focused helper file if the service exceeds 400 lines.

- [ ] **Step 5: Run Chat RAG verification**

Run:

```bash
pnpm exec vitest run apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts apps/backend/knowledge-server/src/knowledge/knowledge.errors.ts apps/backend/knowledge-server/test/knowledge/knowledge-frontend-mvp.controller.test.ts
git commit -m "feat: generate knowledge chat answers with rag"
```

---

### Task 6: Codex-Style Frontend Chat Lab

**Files:**

- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-helpers.ts`
- Modify: `apps/frontend/knowledge/src/types/chat.ts`
- Modify: `apps/frontend/knowledge/src/styles/knowledge-pro.css`
- Test: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

- [ ] **Step 1: Write failing frontend tests**

Add assertions to `knowledge-chat-lab-citations.test.tsx`:

```ts
expect(screen.getByText('我们该构建什么？')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /新对话/ })).toBeInTheDocument();
expect(screen.queryByText('Ant Design X')).not.toBeInTheDocument();

await user.type(screen.getByPlaceholderText('要求后续变更'), '知识库向量放在哪里？');
await user.click(screen.getByRole('button', { name: /提交/ }));

expect(client.chat).toHaveBeenCalledWith({
  model: 'knowledge-rag',
  messages: [{ role: 'user', content: '知识库向量放在哪里？' }],
  metadata: expect.objectContaining({ debug: true }),
  stream: false
});
expect(await screen.findByText('已处理')).toBeInTheDocument();
expect(screen.getByText('route')).toBeInTheDocument();
expect(screen.getByText('Supabase PostgreSQL + pgvector')).toBeInTheDocument();
```

- [ ] **Step 2: Run frontend tests and verify they fail**

Run:

```bash
pnpm exec vitest run apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx
```

Expected: FAIL because current UI still renders Ant Design X welcome copy and lacks Codex-style steps.

- [ ] **Step 3: Implement Codex-style layout**

Refactor `ChatLabPage` into these internal sections:

```tsx
<PageSection title="">
  <div className="knowledge-codex-shell">
    <aside className="knowledge-codex-sidebar">...</aside>
    <main className="knowledge-codex-main">
      <header className="knowledge-codex-topbar">...</header>
      <section className="knowledge-codex-thread">...</section>
      <footer className="knowledge-codex-composer">...</footer>
    </main>
  </div>
</PageSection>
```

Render empty state title `我们该构建什么？`, a fixed bottom composer, conversation bubbles, response step rows, citation cards, copy/feedback/trace actions.

- [ ] **Step 4: Update CSS without nested cards**

Add classes in `knowledge-pro.css`:

```css
.knowledge-codex-shell {
  display: grid;
  grid-template-columns: 288px minmax(0, 1fr);
  min-height: calc(100vh - 96px);
  background: #ffffff;
}

.knowledge-codex-sidebar {
  background: #e8f7fb;
  border-right: 1px solid rgba(15, 23, 42, 0.08);
  padding: 18px;
}

.knowledge-codex-main {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
}

.knowledge-codex-composer {
  position: sticky;
  bottom: 0;
  padding: 18px 24px 24px;
  background: rgba(255, 255, 255, 0.96);
}
```

Keep cards only for citations or repeated list items. Do not place cards inside cards.

- [ ] **Step 5: Run frontend verification**

Run:

```bash
pnpm exec vitest run apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

Run:

```bash
git add apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx apps/frontend/knowledge/src/pages/chat-lab/chat-lab-helpers.ts apps/frontend/knowledge/src/types/chat.ts apps/frontend/knowledge/src/styles/knowledge-pro.css apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx
git commit -m "feat: redesign knowledge chat lab"
```

---

### Task 7: SDK, Backend, Frontend Docs And Final Verification

**Files:**

- Modify: `docs/packages/knowledge/sdk.md`
- Modify: `docs/apps/backend/knowledge-server/knowledge-server.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/contracts/api/knowledge.md`

- [ ] **Step 1: Update SDK usage docs**

Add a section to `docs/packages/knowledge/sdk.md` with this canonical backend example:

```ts
import { createDefaultKnowledgeSdkRuntime } from '@agent/knowledge/node';

const runtime = createDefaultKnowledgeSdkRuntime({
  chat: {
    provider: 'openai-compatible',
    apiKey: process.env.KNOWLEDGE_CHAT_API_KEY!,
    baseURL: process.env.KNOWLEDGE_CHAT_BASE_URL,
    model: process.env.KNOWLEDGE_CHAT_MODEL ?? 'MiniMax-M2.7'
  },
  embedding: {
    provider: 'openai-compatible',
    apiKey: process.env.KNOWLEDGE_EMBEDDING_API_KEY!,
    baseURL: process.env.KNOWLEDGE_EMBEDDING_BASE_URL,
    model: process.env.KNOWLEDGE_EMBEDDING_MODEL_ID ?? 'text-embedding-3-small',
    dimensions: Number(process.env.KNOWLEDGE_EMBEDDING_DIMENSIONS ?? 1536)
  },
  vectorStore: {
    client: supabaseRpcClient,
    knowledgeBaseId: 'kb_default'
  }
});
```

State that browser clients must not import `@agent/knowledge/node` or server adapters.

- [ ] **Step 2: Update backend and API docs**

Document:

- Supabase PostgreSQL + pgvector is production canonical store.
- `InMemoryKnowledgeRepository` is test/local demo only.
- `/api/chat` uses embedding, pgvector retrieval, and chat provider generation.
- `ChatResponse.steps`, `durationMs`, `knowledgeBaseIds`, and `model` are display-safe fields.
- Provider errors map to stable project error codes.

- [ ] **Step 3: Update frontend docs**

Document:

- Chat Lab uses Codex-style workspace layout.
- Frontend sends OpenAI-style payload with `messages` and `metadata.mentions`.
- Frontend never sends provider keys or talks to Supabase directly.

- [ ] **Step 4: Run final affected verification**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/sdk-default-runtime.test.ts apps/backend/knowledge-server/test/knowledge apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/knowledge-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

Run:

```bash
git add docs/packages/knowledge/sdk.md docs/apps/backend/knowledge-server/knowledge-server.md docs/apps/frontend/knowledge/knowledge-frontend.md docs/contracts/api/knowledge.md
git commit -m "docs: document knowledge sdk rag integration"
```

---

## Self-Review

- Spec coverage: Tasks 1 and 7 cover SDK usage and default runtime; Tasks 2-4 cover Supabase PostgreSQL + pgvector canonical storage and ingestion; Task 5 covers real LLM-backed `/api/chat`; Task 6 covers Codex-style Chat Lab; Task 7 covers API/backend/frontend docs.
- Placeholder scan: no unresolved placeholder wording or vague handoff steps are present.
- Type consistency: `KnowledgeSdkRuntime`, `KnowledgeEmbeddingProvider`, `KnowledgeChatProvider`, `KnowledgeSdkVectorStore`, `steps`, `durationMs`, `knowledgeBaseIds`, and `model` are introduced before later tasks consume them.
