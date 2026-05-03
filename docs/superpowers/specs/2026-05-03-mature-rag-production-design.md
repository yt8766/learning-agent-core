# Mature RAG Production Design

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-03

## 背景

当前知识库已经有 RAG SDK runtime、SSE、Chat Lab 前端流式消费和一部分 diagnostics contract，但还没有达到可用的成熟 RAG 阶段。核心缺口不在前端是否传参，而在主链智能能力和产品闭环还没有真正接上：

- `knowledge-server` 的 planner provider 仍是 deterministic fallback，只会选择显式知识库或全部可访问知识库，并把 `queryVariants` 设为原问题。
- repository search adapter 仍是弱关键词 token score，对中文连续词、同义表达和技术术语改写不友好。
- 默认 Chat Lab 请求仍写死 `model: "knowledge-rag"`，用户无法选择 RAG 模型 profile。
- Chat Lab 会话只保存在组件内存中，切换页面或刷新后历史消息消失。
- 页面只薄展示 route、retrievalMode 和 citation，没有直观展示 `planner.completed.plan`、`retrieval.completed.diagnostics.executedQueries`、fallback reason 和 0 hit 原因。
- `docs/contracts/api/knowledge.md` 仍保留 `stream:true 尚未承诺` 的旧描述，与当前 SSE 能力不一致。

本设计把目标定为生产级 RAG 主链，而不是补一个演示壳。第一阶段交付必须让 Chat Lab 进入“可以真实使用和定位问题”的阶段。

## 已确认决策

- 成熟度目标：生产级 RAG 主链。
- 模型配置权威来源：`knowledge-server` 自己维护 RAG model profiles，不依赖 `apps/llm-gateway` 作为第一阶段阻塞项。
- 语义召回默认主路径：Postgres + pgvector，复用当前 SDK runtime 与 `match_knowledge_chunks` RPC 方向。
- keyword / 中文子串召回定位：fallback 与诊断对照，不再作为主召回路径。
- Chat Lab 会话持久化：后端持久化会话与消息，支持刷新、切页和跨设备恢复。

## 目标

- 接入真实 LLM-first `PreRetrievalPlanner` provider，生成 `rewrittenQuery`、`queryVariants`、选库计划、搜索模式和 planner diagnostics。
- 默认走 pgvector 语义召回，并以 keyword / 中文子串检索作为可解释 fallback。
- 让 `queryVariants` 在 retrieval runtime 中真正执行，并记录每个 query 的 mode、hit count、fallback reason。
- 在 `knowledge-server` 中建立 RAG model profiles，让 Chat Lab 可选择“用于编程”“适合日常工作”等产品化模型档位。
- 建立后端 conversation/message 持久化，Chat Lab 切页、刷新、重新进入时不丢历史。
- 前端清楚展示 planner、retrieval、answer 三段 diagnostics，让用户知道选了哪些库、执行了哪些 query、为什么 0 hit。
- 更新 API 文档与模块文档，删除或修正过时描述。

## 非目标

- 第一阶段不把模型配置迁入 `apps/llm-gateway`。后续可以通过 adapter 同步，但不阻塞 knowledge 产品可用。
- 第一阶段不做复杂 agentic multi-hop RAG、自反思补查循环或自动规划多轮工具调用。
- 第一阶段不把 OpenSearch 作为默认检索后端。OpenSearch 可作为后续 hybrid provider 插件接入。
- 前端不暴露 provider secret、base URL、裸 SDK response 或第三方错误对象。

## 总体架构

```text
Chat Lab
  -> knowledge-server Chat API
  -> conversation/message persistence
  -> RagModelProfile resolution
  -> LLM PreRetrievalPlanner
  -> pgvector semantic retrieval
  -> keyword / Chinese substring fallback
  -> grounded answer provider
  -> trace / diagnostics / feedback
  -> SSE events + final ChatResponse
```

`packages/knowledge` 继续作为稳定 SDK runtime，负责 schema-first contracts、planner runtime、retrieval runtime、answer runtime、stream event 和防御性解析。它不依赖 Nest、HTTP、Postgres 业务表或前端展示模型。

`apps/backend/knowledge-server` 是产品宿主，负责 RAG model profiles、用户可访问知识库、会话消息、provider 装配、Postgres/pgvector adapter、trace 记录和 API 映射。当前 deterministic `resolveKnowledgeChatRoute()` 只保留为显式 mention / legacy ids / planner 失败 fallback，不再作为主路由。

`apps/frontend/knowledge` 只消费 `KnowledgeApiProvider`。Chat Lab 从后端加载会话、消息、模型选项和 diagnostics；模型选择随请求提交，但不暴露 provider secret。

## 数据契约

### RAG Model Profile

```ts
interface RagModelProfile {
  id: string;
  label: string;
  description?: string;
  useCase: 'coding' | 'daily' | 'balanced';
  plannerModelId: string;
  answerModelId: string;
  embeddingModelId: string;
  enabled: boolean;
}

interface RagModelProfileSummary {
  id: string;
  label: string;
  description?: string;
  useCase: 'coding' | 'daily' | 'balanced';
  enabled: boolean;
}
```

第一版 profile 由 `knowledge-server` 配置和投影。示例：

- `coding-pro`：用于编程，更专业的回答与控制。
- `daily-balanced`：适合日常工作，同样强大，技术细节更少。

`RagModelProfile` 是后端内部配置；`RagModelProfileSummary` 是前端响应。前端只展示 `id`、`label`、`description`、`useCase`、`enabled` 等 display-safe 字段。`plannerModelId`、`answerModelId`、`embeddingModelId` 不进入第一阶段前端响应，避免页面耦合底层模型编排；后端也不得下发 secret、base URL 或 vendor raw config。

### Conversation

```ts
interface KnowledgeChatConversation {
  id: string;
  title: string;
  activeModelProfileId: string;
  createdAt: string;
  updatedAt: string;
}
```

### Diagnostics

```ts
interface KnowledgeChatDiagnostics {
  planner: {
    rewrittenQuery?: string;
    queryVariants: string[];
    selectedKnowledgeBaseIds: string[];
    routingDecisions: Array<{
      knowledgeBaseId: string;
      selected: boolean;
      reason: string;
    }>;
    confidence: number;
    fallbackApplied: boolean;
    fallbackReason?: string;
  };
  retrieval: {
    effectiveSearchMode: 'vector' | 'keyword' | 'hybrid' | 'fallback-keyword' | 'none';
    executedQueries: Array<{
      query: string;
      mode: 'vector' | 'keyword' | 'substring';
      hitCount: number;
      fallbackReason?: string;
    }>;
    vectorHitCount: number;
    keywordHitCount: number;
    finalHitCount: number;
  };
  generation?: {
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
  };
}
```

Diagnostics 是 redacted display projection。不得透传第三方 SDK error、raw headers、request config、vendor response、secret、token 或 embedding 数组。

## API 设计

### `GET /rag/model-profiles`

返回 Chat Lab 可用模型 profile 列表。

```ts
interface RagModelProfileListResponse {
  items: RagModelProfileSummary[];
}
```

错误码：

- `auth_unauthorized`
- `auth_forbidden`

### `POST /chat`

继续兼容 OpenAI-like `model/messages/metadata/stream`。`model` 的第一阶段语义为 `RagModelProfile.id` 或兼容别名。后端根据 profile 选择 planner、answer、embedding model。

请求：

```ts
interface ChatRequest {
  model?: string;
  messages?: OpenAIChatMessage[];
  metadata?: {
    conversationId?: string;
    knowledgeBaseId?: string;
    knowledgeBaseIds?: string[] | string;
    mentions?: KnowledgeChatMention[];
    debug?: boolean | string;
  };
  stream?: boolean;
}
```

成功后必须持久化：

- user message
- assistant message
- selected model profile
- route / planner diagnostics
- retrieval diagnostics
- citations
- traceId

SSE 模式下，`rag.completed` 后端确认最终结果，再写入 assistant message。SSE 中断或 answer provider 失败时，trace 标记 failed，不把 partial answer 写成成功 assistant message。

### `GET /conversations`

返回当前用户可访问的 Chat Lab 会话。

### `GET /conversations/:id/messages`

返回会话消息，包含 assistant message 的 citations、route、diagnostics、traceId 和 feedback summary。

### `POST /messages/:id/feedback`

沿用当前 feedback endpoint，并确保反馈能挂到持久化 assistant message。

## Planner 设计

`knowledge-server` 新增真实 `KnowledgeStructuredPlannerProvider` 实现，内部复用 SDK runtime 的 chat provider 或 model profile 指定 planner model。Planner prompt 必须要求结构化 JSON 输出，并由 SDK schema 防御。

示例输出：

```json
{
  "rewrittenQuery": "PreRetrievalPlanner query rewrite pre-retrieval routing query variants",
  "queryVariants": [
    "PreRetrievalPlanner query rewrite",
    "pre-retrieval routing query variants",
    "检索前规划 查询改写 查询变体"
  ],
  "selectedKnowledgeBaseIds": ["kb_core"],
  "searchMode": "hybrid",
  "selectionReason": "The query asks about pre-retrieval planning terms and should search the SDK/runtime knowledge base.",
  "confidence": 0.86
}
```

SDK `DefaultPreRetrievalPlanner` 继续负责：

- schema parse
- 非法或越权 knowledge base id 过滤
- 低置信 fallback
- 空 `queryVariants` 补 `rewrittenQuery` / `originalQuery`
- diagnostics 记录 `planner=llm | fallback`

`resolveKnowledgeChatRoute()` 的职责收缩为：

- 显式 `metadata.mentions` 和 legacy ids 兼容
- planner provider 失败时 fallback
- 测试和本地无 LLM 配置 demo

它不再提前锁死主链检索范围。

## Retrieval 设计

`KnowledgeServerSearchServiceAdapter` 改为 pgvector-first：

1. 读取 planner 的 `rewrittenQuery` 和 `queryVariants`。
2. 对每个 query 调用 embedding provider。
3. 对每个 selected knowledge base 执行 `vectorStore.search()` / `match_knowledge_chunks`。
4. 合并、去重、按 score 排序并截断 topK。
5. 如果 vector provider 不可用或无命中，执行 keyword / 中文子串 fallback。
6. 记录 `executedQueries`、`effectiveSearchMode`、各模式 hit count 和 fallback reason。

中文 fallback 只做兜底，不替代 semantic retrieval：

- 连续中文 query 支持 `content.includes(query)`。
- query 长于阈值时生成 2-4 字滑窗短语。
- 英文/数字继续保留 token 命中。
- fallback score 应低于 vector score 区间，避免覆盖语义召回。

Answer provider 只能基于 retrieval citations/context 回答。citation 只来自 retrieval hits，模型生成的引用 ID 不进入最终 response。

## Chat Lab 设计

Chat Lab 保留当前三块布局：左侧会话、主聊天线程、底部输入框。

必须补齐：

- 左侧会话从 `GET /conversations` 加载。
- 切换会话时调用 `GET /conversations/:id/messages`。
- 新建会话先创建本地 draft，首次发送后以后端返回 `conversationId` 为准。
- 顶部增加 model profile selector，样式参考“用于编程 / 适合日常工作”的卡片式选择。
- 每条 assistant message 下方增加可折叠检索诊断：
  - planner：rewritten query、query variants、选中的知识库、confidence、fallback。
  - retrieval：executedQueries、vector hit、keyword fallback hit、final hit。
  - answer：provider、model、token usage、duration。
- citation cards 展示 title、quote、score、uri，并补充命中 query / mode。
- 流式过程中显示语义阶段：选库中、语义召回中、fallback 检索中、生成中。
- 当前搜索按钮如果没有真实能力，应隐藏或降级为本地已加载会话过滤，不能保留假按钮。

## 错误处理

- planner 失败：降级 deterministic fallback，diagnostics 标明 `fallbackReason=planner-error`。
- planner 低置信：按策略扩大到可访问知识库，标明 `low-confidence`。
- embedding / pgvector 不可用：降级 keyword / 中文子串 fallback。
- vector 和 fallback 都无命中：返回明确 no-answer，并展示 executed queries 与 0 hit 原因。
- answer provider 失败：返回 `503 knowledge_chat_failed`；user message 可持久化，assistant message 标记 failed 或不写成功记录。
- SSE 中断：trace 标记 failed，前端保留 partial stream 状态但不写成成功 assistant message。
- model profile missing：`400 rag_model_profile_not_found`。
- model profile disabled：`400 rag_model_profile_disabled`。

## 测试策略

`packages/knowledge`：

- planner schema parse 与 fallback 防御。
- stream event contract。
- retrieval diagnostics contract。

`apps/backend/knowledge-server`：

- LLM planner provider mock 输出 parse。
- planner provider 失败和低置信 fallback。
- pgvector search adapter mock。
- keyword / 中文子串 fallback。
- chat persistence。
- SSE `rag.completed` 后持久化。
- model profile API。

`apps/frontend/knowledge`：

- Chat Lab 会话列表加载。
- 切换会话恢复历史消息。
- model profile 选择随请求发送。
- stream diagnostics 展示。
- planner/retrieval 0 hit 诊断展示。

文档验证：

- 纯设计文档执行 `pnpm check:docs`。
- 进入实现阶段后按 [验证体系规范](/docs/packages/evals/verification-system-guidelines.md) 对受影响范围执行 Type、Spec、Unit、Demo、Integration 分层验证。

## 文档更新

实现阶段必须同步更新：

- `docs/contracts/api/knowledge.md`：修正 `stream:true 尚未承诺`，补 model profile、conversation persistence、SSE event、diagnostics contract。
- `docs/apps/backend/knowledge-server/knowledge-server.md`：说明 RAG model profile、LLM planner provider、pgvector retrieval adapter 和 fallback。
- `docs/apps/frontend/knowledge/knowledge-chat-lab.md`：说明 Chat Lab 会话恢复、模型选择、诊断面板和 citation 展示。
- 如发现旧 RAG 设计文档与真实实现冲突，应直接修正旧文档或标注过时入口，避免知识分叉。

## 分阶段实施

1. Contract 与持久化底座：model profiles、conversation/message API、diagnostics schema、API 文档。
2. LLM planner provider：structured output、query rewrite、query variants、planner diagnostics。
3. pgvector retrieval adapter：embedding query variants、vector search、fallback keyword/中文子串、executedQueries。
4. Chat Lab 产品化：模型选择、会话恢复、诊断面板、SSE 状态。
5. 收口验证与清理：移除假按钮和旧描述，修正文档，补受影响范围测试。

## 完成条件

用户在 Chat Lab 选择模型 profile，提问“检索前技术名词”时：

- 后端通过 LLM planner 生成 query rewrite 和 query variants。
- planner 能选择合适知识库，或在低置信/失败时可解释 fallback。
- 默认通过 pgvector 执行语义召回。
- fallback keyword / 中文子串只在无 vector 命中或 provider 不可用时触发。
- 有命中时生成带 grounded citations 的回答。
- 无命中时返回 no-answer，并在页面展示 executed queries、selected knowledge bases、fallback reason 和 hit count。
- 切换页面、刷新或重新进入 Chat Lab 后，会话和消息仍可恢复。
- 文档与实际 API 保持一致，不再保留 `stream:true 尚未承诺` 的旧描述。
