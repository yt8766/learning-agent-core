# Knowledge Provider Adapters 设计

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/knowledge`、`apps/frontend/knowledge`
最后核对：2026-05-02

## 背景

`packages/knowledge` 后续需要作为可独立发布的 Knowledge SDK。当前包内已经有 `core`、`indexing`、`retrieval`、`runtime`、`client`、`browser`、`node` 等边界，但生产模型接入仍不完整：

- 上传文档后的 embedding 默认仍可能落到 deterministic 占位实现。
- RAG Chat 的检索与回答生成还没有完整接入可配置厂商模型。
- Knowledge SDK 需要默认 MiniMax，同时支持 DeepSeek、GLM、OpenAI-compatible 与用户自定义 provider。
- 用户希望厂商模型通过 LangChain 的 `ChatOpenAI` / `OpenAIEmbeddings` 方式创建，包括向量模型。

本设计选择“工作区默认配置 + 知识库覆盖”的方案，并在 `packages/knowledge` 内新增官方 `adapters` 层。

## 目标

- `@agent/knowledge` 独立发布时提供清晰的 SDK adapter 边界。
- 默认使用 MiniMax，DeepSeek、GLM、OpenAI-compatible 作为可选接入。
- 厂商 chat 与 embedding 模型优先通过 `@langchain/openai` 的 `ChatOpenAI` / `OpenAIEmbeddings` 创建。
- Knowledge runtime 只消费项目自定义 provider contract，不直接依赖 LangChain 或厂商 SDK 类型。
- 上传索引、RAG Chat、评测和观测都能记录稳定的 provider/model 元数据。
- 切换 embedding 模型或维度时能识别索引兼容性并触发 reindex 语义。

## 非目标

- 不在本设计中实现所有厂商的完整生产接线。
- 不把 `packages/adapters` 迁空；仓库级通用 adapter 包仍可服务其他模块。
- 不让 `core`、API DTO、trace 或数据库记录暴露 LangChain、MiniMax、DeepSeek、GLM 的原始对象。
- 不把 provider 密钥下发到前端。
- 不把 RAG 主链编排写进 adapter；adapter 只负责适配到 SDK 接口。

## 包职责

`packages/knowledge` 内部按以下职责分层：

```text
packages/knowledge/src/
  core/
    稳定 schema、类型、错误、provider interface

  indexing/
    loader / chunker / embedder / indexing pipeline contract

  retrieval/
    keyword / vector / hybrid retrieval 基础能力

  runtime/
    retrieve -> rerank -> context assembly -> generate 的运行时编排

  adapters/
    官方 SDK adapter 层
    把 LangChain、MiniMax、DeepSeek、GLM、OpenAI-compatible、vector store 等能力
    收敛到 core / indexing / runtime 的稳定接口
```

`packages/knowledge/src/adapters` 的职责参考 adapter 包设计文档：

- 实现 SDK 已存在的组件接口。
- 将第三方 SDK 输入输出转换为 SDK 共享模型。
- 屏蔽第三方 SDK 差异。
- 提供默认接入方案，但不把 SDK 与某个厂商绑定死。
- 对 metadata、id、usage、error、message content 做必要收敛。

`adapters` 不负责：

- 定义共享数据模型。
- 编排 indexing pipeline 或 runtime pipeline。
- 修改 `core` 与 `indexing` 的公开契约。
- 把第三方 SDK 类型暴露为 SDK 公开返回值。

## 目录结构

第一阶段建议新增目录：

```text
packages/knowledge/src/adapters/
  index.ts

  shared/
    langchain-message.ts
    langchain-usage.ts
    metadata.ts
    provider-errors.ts

  langchain/
    chat/
      langchain-chat-provider.ts
      chat-openai-provider.ts
      index.ts
    embeddings/
      langchain-embedding-provider.ts
      openai-embeddings-provider.ts
      index.ts
    loaders/
    chunkers/
    index.ts

  minimax/
    minimax-chat-openai.ts
    minimax-embeddings-openai.ts
    index.ts

  deepseek/
    deepseek-chat-openai.ts
    index.ts

  glm/
    glm-chat-openai.ts
    glm-embeddings-openai.ts
    index.ts

  openai-compatible/
    openai-compatible-chat-openai.ts
    openai-compatible-embeddings.ts
    index.ts

  vector-stores/
    memory/
    supabase-pgvector/
    chroma/
    index.ts
```

第一阶段优先实现：

1. LangChain chat / embedding 基础 wrapper。
2. MiniMax chat / embedding preset。
3. OpenAI-compatible chat / embedding preset。
4. GLM chat / embedding preset。
5. DeepSeek chat preset。
6. Memory 与 Supabase pgvector vector store 的 SDK adapter 边界。

Chroma、LangChain loader / chunker 可按后续 indexing 需求分步补齐。

## Core Provider Contract

`core` 定义 provider contract，`adapters` 实现这些 contract。

```ts
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
  embedText(input: EmbedTextInput): Promise<EmbedTextResult>;
  embedBatch(input: EmbedBatchInput): Promise<EmbedBatchResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface KnowledgeRerankProvider {
  readonly providerId: string;
  rerank(input: KnowledgeRerankInput): Promise<KnowledgeRerankResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface KnowledgeJudgeProvider {
  readonly providerId: string;
  judge(input: KnowledgeJudgeInput): Promise<KnowledgeJudgeResult>;
  healthCheck?(): Promise<ProviderHealth>;
}
```

长期稳定 JSON contract 必须 schema-first。第三方 message、usage、error、response metadata 必须在 adapter 内转换为项目自定义类型。

## LangChain Adapter 策略

厂商模型默认通过 `@langchain/openai` 创建。

Chat 模型：

```ts
import { ChatOpenAI } from '@langchain/openai';

const model = new ChatOpenAI({
  model: 'MiniMax-M2.7',
  apiKey,
  configuration: {
    baseURL: 'https://api.minimaxi.com/v1'
  }
});
```

Embedding 模型：

```ts
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({
  model: 'minimax-embedding-model',
  apiKey,
  configuration: {
    baseURL: 'https://api.minimaxi.com/v1'
  }
});
```

`LangChainChatProvider` 负责：

- 将 Knowledge messages 转成 LangChain messages。
- 调用 `model.invoke()` / `model.stream()`。
- 将 `AIMessage` 内容收敛为 `KnowledgeChatResult`。
- 归一化 usage。
- 将 LangChain 或 vendor error 转成 `KnowledgeProviderError`。

`LangChainEmbeddingProvider` 负责：

- `embedText()` 调用 `embedQuery()`。
- `embedBatch()` 调用 `embedDocuments()`。
- 校验返回向量数量与输入文本数量一致。
- 推断或校验 dimensions。
- 返回 Knowledge SDK 自己的 embedding result。

LangChain 类型只允许出现在 `src/adapters/langchain/*` 或厂商 preset 内，不允许进入 `core`、`runtime`、API DTO、trace、数据库记录或前端类型。

## 厂商 Preset

厂商目录只做 preset，不重复实现协议。

MiniMax 是默认 provider：

```ts
createMiniMaxChatProvider({
  apiKey,
  baseUrl: 'https://api.minimaxi.com/v1',
  model: 'MiniMax-M2.7'
});

createMiniMaxEmbeddingProvider({
  apiKey,
  baseUrl: 'https://api.minimaxi.com/v1',
  model: 'minimax-embedding-model',
  dimensions: 1536
});
```

OpenAI-compatible 提供通用 preset：

```ts
createOpenAICompatibleChatProvider({
  providerId,
  apiKey,
  baseUrl,
  model
});

createOpenAICompatibleEmbeddingProvider({
  providerId,
  apiKey,
  baseUrl,
  model,
  dimensions
});
```

GLM preset 可提供 chat + embedding。DeepSeek 第一阶段只要求 chat preset；如用户需要 DeepSeek-compatible embedding，可通过 OpenAI-compatible preset 或自定义 provider 接入。

## 配置策略

采用“工作区默认 + 知识库覆盖 + 请求临时覆盖”：

```text
workspace default
  embedding: minimax/<default embedding model>
  chat: minimax/<default chat model>
  rerank: disabled 或 minimax/<default rerank model>
  judge: minimax/<default judge model>

knowledge base override
  可覆盖 embedding / chat / rerank / judge 任一项

request override
  只用于 Chat Lab / Eval Lab 临时调试，不写入默认配置
```

配置记录需要表达：

```ts
export interface KnowledgeModelBinding {
  providerId: string;
  adapter: 'langchain-chat-openai' | 'openai-compatible' | (string & {});
  model: string;
  baseUrl?: string;
  dimensions?: number;
}

export interface KnowledgeModelProfile {
  embedding: KnowledgeModelBinding;
  chat: KnowledgeModelBinding;
  rerank?: KnowledgeModelBinding & { enabled: boolean };
  judge?: KnowledgeModelBinding;
}
```

密钥不进入前端配置，也不进入 API response。后端只返回 provider 是否已配置、health、可用模型、默认模型、维度和能力声明。

## 上传与索引链路

上传文档后：

```text
upload
  -> parser adapter
  -> chunker
  -> embedding provider
  -> vector store adapter
  -> source / chunk / document repository
  -> ingestion receipt
```

默认使用 MiniMax embedding。知识库覆盖为 GLM 或 OpenAI-compatible 时，后端按知识库配置装配对应 adapter。

文档、chunk、receipt 应记录：

```ts
embeddingProviderId;
embeddingModel;
embeddingDimensions;
embeddingVersion;
vectorStoreProviderId;
indexedAt;
needsReindex;
```

索引兼容策略：

- provider、model、dimensions 一致：允许增量索引。
- model 或 dimensions 变化：旧文档标记 `needsReindex`。
- 同一 vector index 不混写不同维度向量。
- query embedding 使用与目标知识库索引兼容的 embedding profile。

主要错误码：

- `knowledge_embedding_provider_not_configured`
- `knowledge_embedding_dimensions_mismatch`
- `knowledge_provider_timeout`
- `knowledge_vector_upsert_failed`
- `knowledge_reindex_required`

## RAG Chat 链路

聊天流程：

```text
message
  -> resolve knowledge base model profile
  -> query embedding
  -> vector retrieval
  -> keyword retrieval
  -> hybrid merge
  -> optional rerank
  -> context assembly
  -> chat provider generate / stream
  -> citations + trace + usage
```

默认使用 MiniMax chat。DeepSeek、GLM、OpenAI-compatible 可作为知识库覆盖或 Chat Lab 请求临时覆盖。

trace 只记录稳定字段：

```ts
chatProviderId;
chatModel;
embeddingProviderId;
embeddingModel;
rerankProviderId;
retrievalMode;
topK;
latencyMs;
usage;
fallbackUsed;
```

trace 不保存 API key、raw vendor response、raw headers、LangChain message object 或 provider stack。

## 后端装配

`apps/backend/agent-server` 负责：

- 读取 workspace 默认 provider 配置。
- 读取 knowledge base override。
- 默认装配 MiniMax adapter。
- 将 provider 注入 `KnowledgeIngestionService`、`KnowledgeRagService`、Eval service。
- 管理密钥、租户、权限、审计和 provider health。
- 暴露前端需要的 provider 列表、模型可选项、配置状态和 health。

后端不手写 MiniMax / DeepSeek / GLM 的 LangChain 创建细节；这些细节应落在 `packages/knowledge/src/adapters/*`。

## 前端能力

`apps/frontend/knowledge` 需要补：

- Workspace 模型默认设置。
- Knowledge base 模型覆盖设置。
- Provider health 和模型能力展示。
- 上传后展示 embedding provider、model、dimensions、索引版本。
- 切换 embedding 模型后提示 reindex。
- Chat Lab 支持临时切换 chat model、retrieval config、topK、rerank。
- Trace 详情展示 provider、model、fallback、usage、retrieval mode。

前端不接触 provider API key，只消费后端 redacted projection。

## 发布与导出

`@agent/knowledge` 后续新增子路径：

```text
@agent/knowledge/adapters
@agent/knowledge/adapters/langchain
@agent/knowledge/adapters/minimax
@agent/knowledge/adapters/deepseek
@agent/knowledge/adapters/glm
@agent/knowledge/adapters/openai-compatible
```

依赖策略：

- `core`、`client`、`browser` 不依赖 LangChain。
- `@langchain/openai` 只由 adapter 子路径使用。
- 第一阶段可将 `@langchain/openai` 作为 `packages/knowledge` 正常依赖，以保证默认 MiniMax 可用。
- 独立发布前可再评估是否改为 optional peer dependency；如果改为 peer，需要在 adapter factory 中输出清晰缺包错误。
- browser 入口不导出 Node-only adapter。

## 测试策略

最小测试应覆盖：

- `core` provider contract schema parse。
- `LangChainChatProvider` 将 fake LangChain result 转换为 `KnowledgeChatResult`。
- `LangChainEmbeddingProvider` 校验向量数量和 dimensions。
- MiniMax / GLM / DeepSeek preset 创建时传入正确 `baseURL`、model 和 providerId。
- 第三方 error 被转换为 `KnowledgeProviderError`，不泄露 raw response。
- 后端根据 workspace default + knowledge base override 解析最终 model profile。
- 上传索引记录 embedding metadata，并在 dimensions 变化时标记 `needsReindex`。
- RAG Chat trace 投影只包含 redacted provider/model/usage 字段。

## 风险与约束

- MiniMax embedding 模型名称和维度需要在实施前用官方配置确认；设计中先保留配置化，不硬编码不可验证的模型名。
- LangChain 的 response metadata 在不同 provider 下可能不一致，adapter 必须防御式归一化。
- 如果某厂商 OpenAI-compatible 行为不完整，只能在厂商 preset 内补兼容逻辑，不能把分支散进 runtime。
- 同一个知识库切换 embedding 维度必须重建索引，不能静默混写。
- 如果 `@langchain/openai` 作为普通依赖导致 SDK 过重，独立发布前应改为 optional peer dependency。
