状态：current
文档类型：guide
适用范围：Knowledge SDK 向量存储默认选型、adapter 边界与自定义 VectorStore 接入
最后核对：2026-05-02

# Knowledge SDK 接入指南

`@agent/knowledge` 是可独立发布的 Knowledge SDK。当前已发布公共边界分为三类：

- `@agent/knowledge`：根入口，导出稳定 schema、类型、官方 adapter factory，以及既有本地检索默认实现。
- `@agent/knowledge/core`：只放长期稳定 contract、provider interface、错误与 pipeline 基础类型。
- `@agent/knowledge/adapters/*`：官方 adapter 子路径，当前包含 LangChain、Chroma、OpenSearch、Supabase pgvector、MiniMax、GLM、DeepSeek 与 OpenAI-compatible。

## 可由使用方实现的接口

SDK 默认面向接口组合，不把 Supabase、具体 LLM 或具体 embedding 模型写进公共 contract。使用方可以自行实现这些接口并传入运行时：

- `EmbeddingProvider`：负责 `embed()` / `embedBatch()`，可接 OpenAI、私有模型或本地 embedding 服务。
- `VectorStore`：负责 `upsert()`、`search()`、`delete()`，可接 Supabase pgvector、Milvus、Qdrant、Pinecone、Elasticsearch 或内部检索服务。
- `KnowledgeChatProvider` / `KnowledgeEmbeddingProvider`：负责 chat / embedding provider 能力，可使用官方 adapter，也可由使用方自行实现。

最小 provider 组合示例：

```ts
import type { KnowledgeChatProvider, KnowledgeEmbeddingProvider, KnowledgeSdkVectorStore } from '@agent/knowledge';

export interface KnowledgeRuntimeProviders {
  chatProvider?: KnowledgeChatProvider;
  embeddingProvider?: KnowledgeEmbeddingProvider;
  vectorStore: KnowledgeSdkVectorStore;
}
```

浏览器 HTTP client、Node runtime factory 与 token refresh 是后续 SDK 子路径草稿；在正式导出前，不应写入发布包接入说明。

## 默认实现

仓库内提供一些默认实现，但它们都不是公共 contract 的硬绑定：

- `@agent/knowledge`：本地检索、query normalizer、post retrieval filter/ranker/diversifier/context assembler、local knowledge store。
- `@agent/knowledge/adapters/supabase`：生产推荐的 `SupabasePgVectorStoreAdapter`。
- `apps/backend/agent-server`：JWT 双 token、摄取、RAG、评测、观测的服务端默认装配。

## 官方 Adapter 层

`@agent/knowledge` 发布包包含官方 adapter 子路径：

- `@agent/knowledge/adapters`
- `@agent/knowledge/adapters/langchain`
- `@agent/knowledge/adapters/chroma`
- `@agent/knowledge/adapters/opensearch`
- `@agent/knowledge/adapters/supabase`
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

Adapter 只返回 Knowledge SDK 自己的 provider contract。LangChain message、usage metadata、vendor response、raw headers 和 provider error 不会穿透到 `core` schema、API DTO、trace 或数据库记录。

## Default Implementations And User Implementations

`@agent/knowledge` exposes stable interfaces and schemas first.
Default implementations currently include local retrieval helpers, ingestion helpers, official model provider adapters, and vector search adapters.
SDK consumers can provide their own repository, vector store, embedding provider, reranker, evaluator, and observability sink by implementing the exported interfaces.
Third-party provider objects must be adapted before crossing SDK or backend service boundaries.

默认 adapter 可以直接接到 SDK 的 `VectorStore`：

```ts
import { SupabasePgVectorStoreAdapter } from '@agent/knowledge/adapters/supabase';

const vectorStore = new SupabasePgVectorStoreAdapter({
  client: supabaseLikeClient,
  tenantId: 'tenant-1',
  knowledgeBaseId: 'kb-default',
  documentId: 'doc-default'
});
```

宿主服务可以把 `vectorStore` 与 chat / embedding provider 一起注入自己的 runtime 或后端服务装配层。

## Supabase pgvector 推荐选型

Knowledge SDK 的生产默认推荐使用 Supabase PostgreSQL + pgvector。这个选择让认证元数据、文档元数据、评测记录、trace 与向量检索可以落在同一套 PostgreSQL 运维体系内，减少早期生产化时的数据库数量、备份策略和权限边界复杂度。

默认 adapter 位于 `@agent/knowledge/adapters/supabase`：

```ts
import { SupabasePgVectorStoreAdapter } from '@agent/knowledge/adapters/supabase';

const vectorStore = new SupabasePgVectorStoreAdapter({
  client: supabaseLikeClient,
  tenantId: 'tenant-1',
  knowledgeBaseId: 'kb-default',
  documentId: 'doc-default'
});
```

adapter 不依赖 Supabase SDK 类型，只要求传入一个最小 RPC client：

```ts
interface SupabaseRpcClientLike {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown | null; error: unknown | null }>;
}
```

默认 RPC 名称如下：

- `upsert(input)` 调用 `upsert_knowledge_chunks`
- `search(input)` 调用 `match_knowledge_chunks`
- `delete(input)` 在解析出 `documentId` 后调用 `delete_knowledge_document_chunks`
- `deleteByDocumentId(input)` 调用 `delete_knowledge_document_chunks`

`SupabasePgVectorStoreAdapter` 默认实现 `@agent/knowledge` 暴露的稳定 `VectorStore` contract，可直接作为 `KnowledgeSdkVectorStore` 使用：

```ts
await vectorStore.upsert({
  records: [
    {
      id: 'chunk-1',
      embedding: [0.1, 0.2, 0.3],
      content: '知识库片段正文',
      metadata: {
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-1',
        tags: ['rag']
      }
    }
  ]
});

const { hits } = await vectorStore.search({
  embedding: [0.1, 0.2, 0.3],
  topK: 5,
  filters: {
    knowledgeBaseId: 'kb-1',
    documentId: 'doc-1',
    query: '检索评测',
    tags: ['rag'],
    metadata: { phase: 'eval' }
  }
});

await vectorStore.delete({
  filter: {
    knowledgeBaseId: 'kb-1',
    documentId: 'doc-1'
  }
});
```

SDK 形状的维度解析规则如下：

- adapter options 可提供默认 `tenantId`、`knowledgeBaseId`、`documentId`。
- `upsert({ records })` 中单条 record 的 `metadata.knowledgeBaseId` / `metadata.documentId` 会覆盖 adapter 默认值；`metadata.tenantId` 也可覆盖默认租户。
- `search({ filters })` / `delete({ filter })` 可通过 `knowledgeBaseId`、`documentId`、`query`、`tags`、`metadata` 传入检索和过滤条件。
- `search` 返回稳定 SDK 形状 `{ hits }`；为兼容 Supabase 专用调用方，返回值中仍保留 `{ matches }`。

adapter 负责把 SDK 输入映射为数据库侧 snake_case 参数，并把检索结果从 snake_case 行映射回稳定结果，例如 `chunk_id` 到 `hits[].id` / `matches[].chunkId`、`document_id` 到 `matches[].documentId`、`content` 或 `text` 到 `hits[].content` / `matches[].text`。RPC 返回 error、调用抛错或返回结构不符合预期时，adapter 会统一转换为 `AdapterError('SupabasePgVectorStoreAdapter', ...)`。错误对象可以保留 raw cause 作为诊断信息，但上层只能依赖 `AdapterError.adapterName` 和 `AdapterError.message`，不应读取或判断 Supabase 原始 cause 的结构。

## 逃生口

Supabase PostgreSQL + pgvector 是默认推荐，不是强绑定。需要 Milvus、Qdrant、Pinecone、Elasticsearch 或私有检索服务时，用户可以实现自己的 `VectorStore` / 向量存储 adapter，并在 Knowledge SDK 装配层传入该实现。

自定义实现应保持同样的边界原则：

- 对业务层暴露项目自己的输入、输出和错误语义。
- 在 adapter 内部完成第三方参数、返回值和错误对象转换。
- 不让第三方 SDK 类型穿透到公共 contract、graph state、持久化记录或 UI 协议。

## 兼容策略

`packages/knowledge/src/core` 采用 schema-first：长期稳定 JSON contract 先导出 Zod schema，再用 `z.infer` 推导类型。语义版本规则如下：

- patch：修正文档、内部实现、非破坏性校验错误信息。
- minor：新增可选字段、新增 schema、新增 provider interface 的可选能力。
- major：删除字段、必填字段改名、枚举值破坏式调整、错误语义不兼容变更。

第三方对象、vendor error、SDK 原始 response 不能穿透到 `core` schema、浏览器 DTO、Graph state 或持久化记录。需要接入新 vendor 时，新增 adapter/provider 实现，而不是修改调用方去识别 vendor-specific 字段。
