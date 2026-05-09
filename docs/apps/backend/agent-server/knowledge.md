# Agent Server Knowledge 后端

状态：current
文档类型：architecture
适用范围：`apps/backend/agent-server/src/api/knowledge`、`apps/backend/agent-server/src/domains/knowledge`
最后核对：2026-05-09

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
```

不要新增 `/api/knowledge/v1/*` 调用方。需要兼容历史客户端时，先在 contract 中明确迁移策略，再评估是否需要独立 compat shell；默认不恢复旧 alias。

## 分层职责

- `src/api/knowledge/*`：Nest controller，只做 HTTP 参数提取、schema parse、identity actor 解析、错误映射和 SSE 封帧。
- `src/domains/knowledge/domain/*`：document、upload、chat 等本地域 schema/type。
- `src/domains/knowledge/repositories/*`：Knowledge repository contract、memory/postgres 实现、mapper 与 helper。
- `src/domains/knowledge/runtime/*`：repository/runtime provider factory、Postgres schema bootstrap 与 SDK runtime 装配。
- `src/domains/knowledge/services/*`：base、upload、document、ingestion queue/worker、frontend settings、provider health、eval、trace、RAG model profile 与 RAG service。
- `src/domains/knowledge/storage/*`：OSS provider contract、memory provider、Aliyun provider 与 storage provider factory。

Controller、service 和 frontend 都只能消费项目自定义 contract/provider/facade。第三方 SDK 对象、vendor response、raw headers、provider error、secret 或 token 不允许穿透到 API DTO、graph state、持久化 display projection 或前端类型。

## Runtime Providers

`KnowledgeDomainModule` 注册 `KnowledgeApiController`、`KnowledgeWorkspaceController`、`KnowledgeSettingsController` 和 `KnowledgeChatSettingsController`，并通过 provider token 装配 repository、OSS storage 与 SDK runtime。

- `KNOWLEDGE_REPOSITORY=memory | postgres`：选择业务数据持久化。未设置时默认 memory；postgres 必须提供 `DATABASE_URL`。
- `KNOWLEDGE_OSS_PROVIDER=memory | aliyun`：选择上传对象存储。Aliyun 模式必须提供 bucket、region 和 access key/secret。
- `KNOWLEDGE_SDK_RUNTIME.enabled=true`：仅在数据库、chat model、embedding model 和 LLM key 等配置完整时启用 SDK RAG runtime；未配置时返回 disabled，不阻断统一后端启动。

`KnowledgeIngestionQueue` 由 `KnowledgeDomainModule.onModuleInit()` 启动，模块销毁时 stop；不要在 HTTP service 内手动 drain 队列。Postgres schema 入口为 `src/domains/knowledge/runtime/knowledge-schema.sql.ts`，不得在其他目录维护第二份 current SQL。

## Ingestion Path

文档入库由 `KnowledgeIngestionWorker` 调用 `@agent/knowledge` indexing pipeline 生成 chunk；当 `KNOWLEDGE_SDK_RUNTIME.enabled=true` 时继续调用 SDK embedding provider 与 vector store upsert，disabled 时只保留 keyword-searchable chunk fallback。

worker 只负责编排：从 OSS 读取上传对象、调用 SDK indexing、映射为 `DocumentChunkRecord`、保存 chunk、更新 document/job 状态。SDK chunk 到后端记录的字段映射集中在 `src/domains/knowledge/services/knowledge-ingestion-sdk.mapper.ts`；不要把 chunk ID、ordinal、tokenCount 或 keyword/embedding/vector 状态映射散落到 controller、repository 或 RAG service。

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
