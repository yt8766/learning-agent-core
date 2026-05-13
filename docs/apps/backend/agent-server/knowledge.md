# Agent Server Knowledge 后端

状态：current
文档类型：architecture
适用范围：`apps/backend/agent-server/src/api/knowledge`、`apps/backend/agent-server/src/domains/knowledge`
最后核对：2026-05-10

Knowledge API 已 hard cut 到 unified `apps/backend/agent-server`。当前唯一 frontend-facing 入口是 `/api/knowledge/*`；standalone `apps/backend/knowledge-server` 与旧 `apps/backend/agent-server/src/knowledge` 已删除，不再作为 current 实现、测试或文档入口。

## 当前入口

HTTP shell：

```text
apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts
apps/backend/agent-server/src/api/knowledge/knowledge-settings.controller.ts
```

领域实现：

```text
apps/backend/agent-server/src/domains/knowledge/knowledge-domain.module.ts
apps/backend/agent-server/src/domains/knowledge/domain/*
apps/backend/agent-server/src/domains/knowledge/repositories/*
apps/backend/agent-server/src/domains/knowledge/runtime/*
apps/backend/agent-server/src/domains/knowledge/services/*
apps/backend/agent-server/src/domains/knowledge/storage/*
```

当前 canonical endpoints：

```text
GET    /api/knowledge/bases
POST   /api/knowledge/bases
GET    /api/knowledge/bases/:baseId/members
POST   /api/knowledge/bases/:baseId/members
GET    /api/knowledge/documents
POST   /api/knowledge/bases/:baseId/uploads
POST   /api/knowledge/bases/:baseId/documents
GET    /api/knowledge/documents/:documentId
GET    /api/knowledge/documents/:documentId/jobs/latest
GET    /api/knowledge/documents/:documentId/chunks
POST   /api/knowledge/documents/:documentId/reprocess
DELETE /api/knowledge/documents/:documentId
GET    /api/knowledge/embedding-models
POST   /api/knowledge/chat
GET    /api/knowledge/rag/model-profiles
GET    /api/knowledge/conversations
GET    /api/knowledge/conversations/:id/messages
POST   /api/knowledge/messages/:messageId/feedback
GET    /api/knowledge/workspace/users
POST   /api/knowledge/workspace/users/invitations
GET    /api/knowledge/settings/model-providers
GET    /api/knowledge/settings/api-keys
POST   /api/knowledge/settings/api-keys
GET    /api/knowledge/settings/storage
GET    /api/knowledge/settings/security
PATCH  /api/knowledge/settings/security
GET    /api/knowledge/chat/assistant-config
PATCH  /api/knowledge/chat/assistant-config
GET    /api/knowledge/dashboard/overview
GET    /api/knowledge/observability/metrics
GET    /api/knowledge/observability/traces
GET    /api/knowledge/observability/traces/:traceId
GET    /api/knowledge/eval/datasets
POST   /api/knowledge/eval/datasets
GET    /api/knowledge/eval/datasets/:datasetId/cases
POST   /api/knowledge/eval/datasets/:datasetId/cases
GET    /api/knowledge/eval/runs
POST   /api/knowledge/eval/runs
GET    /api/knowledge/eval/runs/:runId/results
POST   /api/knowledge/eval/runs/compare
GET    /api/knowledge/agent-flows
POST   /api/knowledge/agent-flows
POST   /api/knowledge/agent-flows/:flowId/run
```

不要新增 `/api/knowledge/v1/*` 调用方。需要兼容历史客户端时，先在 contract 中明确迁移策略，再评估是否需要独立 compat shell；默认不恢复旧 alias。

## 分层职责

- `src/api/knowledge/*`：Nest controller，只做 HTTP 参数提取、schema parse、identity actor 解析、错误映射和 SSE 封帧。
- `src/domains/knowledge/domain/*`：document、upload、chat 等本地域 schema/type。
- `src/domains/knowledge/repositories/*`：Knowledge repository contract、memory/postgres 实现、mapper 与 helper。
- `src/domains/knowledge/runtime/*`：repository/runtime provider factory、Postgres schema bootstrap 与 SDK runtime 装配。
- `src/domains/knowledge/services/*`：base、upload、document、ingestion queue/worker、frontend settings、provider health、eval、trace、dashboard、observability、agent-flow、RAG model profile 与 RAG service。
- `src/domains/knowledge/storage/*`：OSS provider contract、memory provider、Aliyun provider 与 storage provider factory。

Controller、service 和 frontend 都只能消费项目自定义 contract/provider/facade。第三方 SDK 对象、vendor response、raw headers、provider error、secret 或 token 不允许穿透到 API DTO、graph state、持久化 display projection 或前端类型。

## Identity 鉴权入口

`KnowledgeApiController` 从 `request.principal.userId/sub` 或 `Authorization: Bearer <accessToken>` 解析 actor。Bearer token 路径必须通过 `IdentityAuthService.me()` 校验 access token，并返回当前 identity account id 作为 `KnowledgeActor.userId`。

`IdentityAuthService` 是 Nest 运行时注入 token，controller 文件必须使用普通运行时 `import { IdentityAuthService } ...`，不能使用 `import type`。否则 TypeScript 的 decorator metadata 会把构造参数降级成 `Object` / `Function`，而 `@Optional()` 会让后端静默启动但 `identityAuth` 为 `undefined`，最终所有 `/api/knowledge/*` Bearer 请求都会表现成 `401 auth_unauthorized: identity access token is required`。

回归测试入口：`apps/backend/agent-server/test/knowledge/knowledge-canonical-routes.spec.ts` 的 `keeps identity auth injectable for bearer-token knowledge requests` 必须固定 `design:paramtypes` 最后一项为 `IdentityAuthService`。

## Response Envelope

`GET /api/knowledge/bases` 必须返回 `KnowledgeBasesListResponse`，即 `{ bases: KnowledgeBase[] }`。Controller 只能调用 `KnowledgeBaseService.listBasesResponse()`，不要直接返回 `listBases()` 的裸数组；否则前端兼容 normalizer 会把响应误判为 legacy envelope 并在 `input.bases.map` 处崩溃。

## Runtime Providers

`KnowledgeDomainModule` 注册 `KnowledgeApiController`、`KnowledgeWorkspaceController`、`KnowledgeSettingsController` 和 `KnowledgeChatSettingsController`，并通过 provider token 装配 repository、OSS storage 与 SDK runtime。

- `KNOWLEDGE_REPOSITORY=memory | postgres`：选择业务数据持久化。未设置时默认 memory；postgres 必须提供 `DATABASE_URL`。
- `KNOWLEDGE_OSS_PROVIDER=memory | aliyun`：选择上传对象存储。Aliyun 模式必须提供 bucket、region 和 access key/secret。
- `KNOWLEDGE_SDK_RUNTIME.enabled=true`：仅在数据库、chat model、embedding model 和 LLM key 等配置完整时启用 SDK RAG runtime；未配置时返回 disabled，不阻断统一后端启动。

`KnowledgeFrontendSettingsService.listWorkspaceUsers()` 不再维护内置成员样例。它通过 `IdentityUserService.listUsers()` 读取真实 Identity 账号，再通过 `KNOWLEDGE_REPOSITORY` 查询每个用户可访问知识库数量、会话数量和最后活跃时间，最后投影成 `KnowledgeWorkspaceUsersResponse`。因此访问治理页的成员来源应优先通过 `/api/identity/users` 创建/管理；如需数据库持久化，Identity 域必须显式启用 `IDENTITY_REPOSITORY=postgres`。

`KnowledgeIngestionQueue` 由 `KnowledgeDomainModule.onModuleInit()` 启动，模块销毁时 stop；不要在 HTTP service 内手动 drain 队列。Postgres schema 入口为 `src/domains/knowledge/runtime/knowledge-schema.sql.ts`，不得在其他目录维护第二份 current SQL。

## RAG Trace 投影

`KnowledgeTraceService` 仍是后端 workbench trace 的展示/查询入口，`GET /api/knowledge/*` 的既有 trace shape 不变。启用 SDK runtime 且走 streaming RAG 时，`KnowledgeRagSdkFacade` 会用 `@agent/knowledge` 的 in-memory observer 记录 SDK `KnowledgeRagTrace`，`streamWithSdk` 在 `rag.completed` / `rag.error` 后调用 `KnowledgeTraceService.projectSdkTrace()` 投影到现有后端 span：

- SDK event name / stage 只以 `sdkEventName`、`sdkStage`、`sdkTraceId` 等标量摘要进入 attributes。
- retrieval/generation 只投影 `hitCount`、`citationCount`、`retrievalMode`、`candidateCount`、`selectedCount`、`latencyMs`、`citedChunkCount`、`groundedCitationRate` 等展示字段。
- `answerText`、raw provider response、vendor object、authorization、token、api key、secret、password 等内容不进入后端 trace attributes；失败 span 的 `error.message` 也必须经过后端脱敏/截断，不允许原样投影 provider/vendor message。
- answer provider 在 retrieval 后抛错时，SDK streaming facade 必须先导出 failed SDK trace 并投影 failure span，再让外层 stream 维持原有错误传播语义。
- local deterministic RAG fallback 仍保留原有手写 `route/retrieve/generate` span，确保禁用 SDK runtime 时前端 API 兼容。

## Ingestion Path

文档入库由 `KnowledgeIngestionWorker` 调用 `@agent/knowledge` indexing pipeline 生成 chunk；当 `KNOWLEDGE_SDK_RUNTIME.enabled=true` 时继续调用 SDK embedding provider 与 vector store upsert，disabled 时只保留 keyword-searchable chunk fallback。

worker 只负责编排：从 OSS 读取上传对象、调用 SDK indexing、映射为 `DocumentChunkRecord`、保存 chunk、更新 document/job 状态。SDK chunk 到后端记录的字段映射集中在 `src/domains/knowledge/services/knowledge-ingestion-sdk.mapper.ts`；不要把 chunk ID、ordinal、tokenCount 或 keyword/embedding/vector 状态映射散落到 controller、repository 或 RAG service。

chunker 选择由 worker 在进入 SDK indexing 前完成：

- 默认 `KNOWLEDGE_INGESTION_CHUNKER=auto`。`text/*`、`*markdown*` content type，以及 `.md`、`.mdx`、`.markdown`、`.txt`、`.text` 文件使用 `StructuredTextChunker`。
- `KNOWLEDGE_INGESTION_CHUNKER=structured` 强制使用结构化 chunker。
- `KNOWLEDGE_INGESTION_CHUNKER=fixed` 强制回退 `FixedWindowChunker`。

结构化 chunk metadata 会随 ingestion 保存到 `DocumentChunkRecord.metadata`，并合并进 vector upsert record 的 `metadata`。当前稳定字段包括 `parentId`、`sectionId`、`sectionTitle`、`heading`、`sectionPath`、`contentType`、`ordinal`、`chunkHash`，以及相邻 chunk 存在时的 `prevChunkId` / `nextChunkId`。旧 fixed-window chunk 没有这些字段，retrieval 与展示层必须按字段可选处理。

runtime enabled 时，worker 必须先通过 indexing 质量门再把向量状态标记为成功：`embedBatch()` 返回数量必须等于 chunk 数量，每个 embedding 必须非空且维度一致，`vectorStore.upsert()` 必须返回与写入 records 数一致的 `upsertedCount`。embedding 质量门失败时 job 停在 `currentStage: "embed"`，vector 写入数量未知或不一致时停在 `currentStage: "index_vector"`；两者都不能把坏向量计入 `embeddedChunkCount`。

disabled runtime 下 chunk 的 `embeddingStatus` 与 `vectorIndexStatus` 记录为 `skipped`，`keywordIndexStatus` 仍为 `succeeded`，以保证本地 deterministic keyword fallback 可检索，同时不把未执行的 embedding/vector 写成成功。

## 验证入口

核心回归：

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/knowledge apps/backend/agent-server/test/knowledge-domain
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

删除边界：

```bash
rg -n "src/knowledge|KnowledgeModule|KnowledgeProviderModule|knowledge/v1" apps/backend/agent-server/src apps/backend/agent-server/test
```

允许剩余命中只应是负向测试或明确说明旧路径已删除的历史文档。

## Duyi Knowledge Bases Reference Boundary

`/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/duyi-knowledge-bases` 可作为企业知识库业务闭环参考，但不能作为源码搬运来源。当前后端只吸收四类语义：RAG pipeline 可解释性、ingestion 质量门、retrieval trace debug、文档生命周期阻断。

后端 controller 仍只做 HTTP shell；资源权限、文档任务、trace projection 和 SDK runtime 装配必须留在 `apps/backend/agent-server/src/domains/knowledge`。稳定 contract 仍来自 `@agent/knowledge` 或 `packages/core/src/contracts/knowledge-service`，不得新增 `@duyi/specs` 或第二套 shared contract。
