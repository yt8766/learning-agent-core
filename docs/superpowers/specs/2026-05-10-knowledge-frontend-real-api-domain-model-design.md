# Knowledge Frontend Real API Domain Model Design

状态：draft
文档类型：spec
适用范围：`apps/frontend/knowledge`、`apps/backend/agent-server/src/api/knowledge`、`apps/backend/agent-server/src/domains/knowledge`、`packages/core/src/contracts/knowledge-service`、`packages/knowledge`
最后核对：2026-05-10

## 背景

`apps/frontend/knowledge` 已经有 `KnowledgeApiProvider`、真实 `KnowledgeApiClient`、局部后端 Knowledge domain 和一批 API contract 文档，但运行时代码仍保留 `MockKnowledgeApiClient`、`mock-data` 和显式 `VITE_KNOWLEDGE_API_MODE=mock` 分支。前端本地 `src/types/*` 也承担了长期业务 DTO 定义，导致页面类型、后端响应和 `packages/core` schema 存在继续分叉的风险。

本设计选择 **Core Contract First + 全页面真实 API 切换**。实现阶段可以分批落地，但 API 领域模型必须一次性覆盖 Knowledge 前端所有页面，避免继续按页面堆 mock 或临时 DTO。

## 目标

1. `apps/frontend/knowledge` 全页面运行时数据源统一来自 unified `agent-server` 的 `/api/knowledge/*` 和 `/api/identity/*`。
2. 删除前端运行时 mock client、mock data 和 `VITE_KNOWLEDGE_API_MODE` 装配分支。
3. 以 `packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts` 作为 Knowledge 前端工作台 API 的 schema-first 源头。
4. 已有 `@agent/knowledge` 稳定 contract 的 RAG / Agent Flow 能力继续复用，不在 `core` 里复制第二套长期模型。
5. 后端允许短期用 schema-safe service fixture 补齐暂未接数据库的页面数据，但 fixture 只能存在于后端 domain/service 层，不能作为前端 runtime 数据源。
6. 更新 API 文档、前端架构文档和过时 mock 说明，保证后续 AI 和开发者以同一份 contract 为准。

## 非目标

1. 本设计不重做 Knowledge UI 布局。
2. 本设计不要求一次性接入所有真实数据库表、外部 provider 或异步队列。
3. 本设计不改变 `agent-chat` 或 `agent-admin` 产品职责。
4. 本设计不把 `@agent/knowledge` 的 RAG SDK contract 搬进 `packages/core`。
5. 本设计不新增 standalone knowledge server，也不恢复旧 `/api/knowledge/v1`。

## 领域边界

### Stable Contract

`packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts` 承载 Knowledge 前端工作台稳定 JSON contract：

- 通用分页、错误、时间、ID、redacted payload projection。
- Dashboard projection。
- Knowledge base、member、health、permission projection。
- Document、upload、ingestion job、chunk、embedding model projection。
- Workspace users、settings、assistant config。
- Observability display projection。
- Eval datasets、cases、runs、results、comparison。

所有稳定类型必须从 zod schema 推导：

```ts
export type KnowledgeDashboardOverview = z.infer<typeof KnowledgeDashboardOverviewSchema>;
```

`packages/core` 不承载高变动运行时聚合逻辑、prompt、provider response、repository record 或 SDK vendor 对象。

### Knowledge SDK Contract

`packages/knowledge` 继续承载 RAG runtime、retrieval、stream event、Agent Flow 等 SDK / runtime contract。前端需要这些类型时，通过 `@agent/knowledge` public exports 消费。

`packages/core` 可以在文档里引用这些 contract 的名字，但不复制其 schema。若某个页面只需要 redacted display projection，应优先在 `knowledge-service` 定义前端 API projection，而不是让 SDK 内部 runtime 类型穿透到页面。

### Backend Domain

后端分层保持：

- `apps/backend/agent-server/src/api/knowledge/*`：HTTP shell、鉴权入口、query/body parse、response parse、错误映射。
- `apps/backend/agent-server/src/domains/knowledge/services/*`：页面 projection 聚合、短期 schema-safe fixture、业务权限、领域错误。
- `apps/backend/agent-server/src/domains/knowledge/repositories/*`：数据库或内存 repository。
- `packages/knowledge`：RAG SDK 和 retrieval/indexing runtime。

Controller 不直接拼页面 DTO，不直接透传 repository raw record，不直接暴露第三方 SDK 对象。

### Frontend Runtime

`apps/frontend/knowledge` 运行时只装配真实 `KnowledgeApiClient`。页面和 hooks 只能通过 `KnowledgeApiProvider` 消费 `KnowledgeFrontendApi`。

`apps/frontend/knowledge/src/types/*` 的最终职责：

- re-export `@agent/core` / `@agent/knowledge` 推导类型；
- 定义 UI-only view model；
- 定义短期迁移期 compat alias，并标注迁移用途。

它不再长期维护独立业务 DTO。

## API 域模型覆盖

### Common

源头：`packages/core/src/contracts/knowledge-service/knowledge-service.schemas.ts`

核心模型：

- `KnowledgePageQuerySchema`
- `KnowledgePageResultSchema<T>`
- `KnowledgeApiErrorResponseSchema`
- `KnowledgeRedactedPayloadSummarySchema`

约束：

- 分页默认 `page=1`、`pageSize=20`，最大 `100`。
- Error details 只能是 redacted JSON-safe projection。
- 所有 response parse 失败视为服务端 contract 回归，测试必须暴露。

### Dashboard

Endpoint：

- `GET /knowledge/dashboard/overview`

模型：

- `KnowledgeDashboardOverviewSchema`
- `KnowledgeDashboardRecentFailureSchema`
- `KnowledgeDashboardMissingKnowledgeQuestionSchema`

职责：

- 后端聚合 knowledge base、document、chat trace、eval run 和 alert 统计。
- 前端只展示后端 projection，不本地推断 readiness。

兼容：

- 聚合来源不足时返回空数组和 `0` 统计。
- 延迟、错误率、无答案率字段保持 `0-1` 小数，展示层再格式化为百分比。

### Knowledge Bases

Endpoint：

- `GET /knowledge/bases`
- `POST /knowledge/bases`
- `GET /knowledge/bases/:baseId`
- `GET /knowledge/bases/:baseId/members`
- `POST /knowledge/bases/:baseId/members`
- `PATCH /knowledge/bases/:baseId/members/:userId`
- `DELETE /knowledge/bases/:baseId/members/:userId`

模型：

- `KnowledgeBaseSchema`
- `KnowledgeBaseHealthSchema`
- `KnowledgeBaseMemberSchema`
- `KnowledgeBaseCreateRequestSchema`
- `KnowledgeBaseUpdateRequestSchema`

职责：

- 后端校验 actor membership 和 role。
- 前端不硬编码 `kb_frontend` 等 fixture id。

兼容：

- 当前已存在 `{ bases: KnowledgeBase[] }` 的旧响应可以在 client normalizer 中短期兼容，但 canonical response 是 `KnowledgePageResult<KnowledgeBase>` 或 `{ base }`。
- 兼容 normalizer 必须有删除计划，不能继续扩散到页面。

### Documents And Ingestion

Endpoint：

- `GET /knowledge/documents`
- `GET /knowledge/documents/:documentId`
- `GET /knowledge/documents/:documentId/jobs/latest`
- `GET /knowledge/documents/:documentId/chunks`
- `POST /knowledge/bases/:baseId/uploads`
- `POST /knowledge/bases/:baseId/documents`
- `POST /knowledge/documents/:documentId/reprocess`
- `DELETE /knowledge/documents/:documentId`
- `GET /knowledge/embedding-models`

模型：

- `KnowledgeDocumentSchema`
- `KnowledgeUploadResultSchema`
- `KnowledgeCreateDocumentFromUploadRequestSchema`
- `KnowledgeCreateDocumentFromUploadResponseSchema`
- `KnowledgeDocumentProcessingJobSchema`
- `KnowledgeDocumentChunkSchema`
- `KnowledgeEmbeddingModelOptionSchema`

职责：

- 上传仍走两步协议：OSS upload proxy -> create document and ingestion job。
- 后端持有 OSS object key 和权限校验；浏览器不持有 OSS credential。
- 前端展示 job `stage`、`status`、`progress.percent`、retryable error 和 chunks。

兼容：

- `uploadDocument()` 作为前端 provider convenience 可以保留为两步协议包装，但不再请求旧单步 upload 路径。
- `currentStage` / legacy stages 仅作为详细 timeline 兼容字段，页面主状态使用稳定 job projection。

### Chat Lab

Endpoint：

- `POST /knowledge/chat`
- `GET /knowledge/rag/model-profiles`
- `GET /knowledge/conversations`
- `GET /knowledge/conversations/:conversationId/messages`
- `POST /knowledge/messages/:messageId/feedback`
- `GET /knowledge/chat/assistant-config`
- `PATCH /knowledge/chat/assistant-config`

模型：

- Chat request / response 优先复用后端 domain schema，并收敛到 `knowledge-service` 或 `@agent/knowledge` 的稳定 projection。
- `KnowledgeChatAssistantConfigSchema`
- `KnowledgeRagModelProfileSummarySchema`
- `KnowledgeChatConversationSchema`
- `KnowledgeChatMessageSchema`
- `KnowledgeChatFeedbackRequestSchema`

职责：

- 前端发送 OpenAI Chat Completions 风格 payload：`model`、`messages`、`metadata.conversationId`、`metadata.mentions`、`stream`。
- 前端不得继续发送旧顶层 `message`、`knowledgeBaseIds` 作为新主路径。
- 后端负责 mention 解析后的权限校验、metadata routing、fallback routing、RAG execution 和 assistant message 持久化。

兼容：

- 旧字段 `message`、`knowledgeBaseIds`、`conversationId` 可由后端短期兼容，但新前端实现不再产生。
- SSE 事件使用 `@agent/knowledge` 的 `KnowledgeRagStreamEventSchema`。

### Observability

Endpoint：

- `GET /knowledge/observability/metrics`
- `GET /knowledge/observability/traces`
- `GET /knowledge/observability/traces/:traceId`

模型：

- `KnowledgeObservabilityMetricsSchema`
- `KnowledgeRagTraceSchema`
- `KnowledgeRagTraceDetailSchema`
- `KnowledgeRagTraceSpanSchema`
- `KnowledgeRetrievalSnapshotSchema`

职责：

- 后端返回 redacted display projection。
- `question`、`answer`、hit preview、payload summary 必须截断并脱敏。
- 前端不展示 raw provider request、raw prompt、raw context、headers、tokens、secret 或 SDK error 对象。

兼容：

- 当前 repository trace 不完整时返回空 metrics/list 或后端 fixture fallback。
- 旧 raw trace 字段只允许在后端 projection 层适配，不让页面分叉两套渲染主逻辑。

### Evals

Endpoint：

- `GET /knowledge/eval/datasets`
- `POST /knowledge/eval/datasets`
- `GET /knowledge/eval/datasets/:datasetId/cases`
- `POST /knowledge/eval/datasets/:datasetId/cases`
- `GET /knowledge/eval/runs`
- `POST /knowledge/eval/runs`
- `GET /knowledge/eval/runs/:runId/results`
- `POST /knowledge/eval/runs/compare`

模型：

- `KnowledgeEvalDatasetSchema`
- `KnowledgeEvalCaseSchema`
- `KnowledgeEvalRunSchema`
- `KnowledgeEvalCaseResultSchema`
- `KnowledgeEvalRunComparisonSchema`

职责：

- 后端可先同步执行 dataset cases，后续替换为异步队列时保持 run/result response 兼容。
- 单 case 失败时 run 可以是 `partial`，保留成功结果和 failed case projection。

兼容：

- 现有前端 `EvalRunStatus` 需要补齐 `partial` 或映射到稳定枚举。
- 分数展示明确区分 `0-1` metric 和 `0-100` report score。

### Workspace Users And Settings

Endpoint：

- `GET /knowledge/workspace/users`
- `POST /knowledge/workspace/users/invitations`
- `GET /knowledge/settings/model-providers`
- `GET /knowledge/settings/api-keys`
- `POST /knowledge/settings/api-keys`
- `GET /knowledge/settings/storage`
- `GET /knowledge/settings/security`
- `PATCH /knowledge/settings/security`

模型：

- 已有 `KnowledgeWorkspaceUserSchema`
- 已有 `KnowledgeModelProviderSchema`
- 已有 `KnowledgeApiKeySchema`
- 已有 `KnowledgeStorageSettingsResponseSchema`
- 已有 `KnowledgeSecuritySettingsResponseSchema`

职责：

- 后端只返回 masked key，不返回 one-time secret，除非后续单独扩展并安全评审。
- settings projection 不透传 provider 原始配置、secret、token 或内部 runtime 状态。

兼容：

- role/status/capability 枚举只能追加。前端未知枚举显示为未知状态。

### Agent Flow

Endpoint：

- `GET /knowledge/agent-flows`
- `POST /knowledge/agent-flows`
- `PUT /knowledge/agent-flows/:flowId`
- `POST /knowledge/agent-flows/:flowId/run`

模型：

- `KnowledgeAgentFlowSchema`
- `KnowledgeAgentFlowListResponseSchema`
- `KnowledgeAgentFlowSaveRequestSchema`
- `KnowledgeAgentFlowRunRequestSchema`
- `KnowledgeAgentFlowRunResponseSchema`

源头继续放在 `@agent/knowledge`。后端只实现真实 storage/service 或 schema-safe service fallback；前端不再使用 mock client 的内存数组。

职责：

- Flow graph/schema/run input 由 `@agent/knowledge` 管理。
- 后端负责 flow ownership、version conflict、run audit 和错误映射。
- 前端只保存和运行 contract 允许的 flow projection。

## Frontend Migration

1. `main.tsx` 删除 `MockKnowledgeApiClient` import 和 `VITE_KNOWLEDGE_API_MODE` 分支，始终创建 `KnowledgeApiClient`。
2. 删除 `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`、`mock-data.ts`、`mock-knowledge-governance-data.ts` 和只服务运行时 mock 的 helper。
3. `KnowledgeApiClient` 每个方法使用 schema parse 或统一 `parseKnowledgeApiResponse(schema, body)`。
4. `KnowledgeFrontendApi` 返回类型改为从 stable contract re-export。
5. 页面测试用局部 fake provider 或 fetch stub，不再 import runtime mock client。
6. 保留 story/demo 需求时，应建立独立测试 fixture 或后端 demo seed，不进入生产 runtime bundle。

## Backend Migration

1. 先补齐 `packages/core` schema 和 `docs/contracts/api/knowledge.md`。
2. Controller 对 request body、query、response 使用 schema parse。
3. 缺失的 Dashboard、Evals、Observability、Agent Flow 路由由后端 domain service 接管。
4. 仍需 fixture 的页面数据集中在 `KnowledgeFrontendSettingsService` 一类后端 service，命名标注为 projection fallback，并通过 schema 测试。
5. 后续接真实 repository 或 provider 时，保持 response DTO 不变，只替换 service 内部数据来源。

## Cleanup

必须清理：

- 前端 runtime mock client 和 mock data。
- `VITE_KNOWLEDGE_API_MODE` 文档。
- “页面先基于 mock 完成”这类过时说明。
- 页面内或 hook 内对 mock id、fixture id、固定数组结构的依赖。
- 与真实 canonical path 冲突的旧 `/knowledge-bases`、`/eval/*`、`/observability/*` 文档表述。

可以保留：

- 测试局部 fixture。
- 后端 service fallback fixture。
- 明确标注迁移期的 response normalizer，但必须有测试覆盖和删除条件。

## Error Semantics

统一错误响应：

```ts
{
  code: string;
  message: string;
  details?: {
    summary?: string;
    fields?: Record<string, string>;
    data?: Record<string, string | number | boolean | null | string[] | number[]>;
    itemIds?: string[];
  };
  requestId?: string;
}
```

通用错误码：

- `auth_unauthorized`
- `auth_forbidden`
- `validation_error`
- `knowledge_base_not_found`
- `knowledge_permission_denied`
- `document_not_found`
- `conversation_not_found`
- `message_not_found`
- `trace_not_found`
- `eval_dataset_not_found`
- `eval_run_not_found`
- `knowledge_agent_flow_not_found`
- `knowledge_agent_flow_conflict`
- `knowledge_chat_failed`

错误 details 不得包含 token、secret、raw headers、provider raw response、vendor SDK error、stack trace 或完整 prompt/context。

## Testing And Verification

Contract:

```bash
pnpm --filter @agent/core test
```

Backend affected checks:

```bash
pnpm --dir apps/backend/agent-server test -- knowledge
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Frontend affected checks:

```bash
pnpm --dir apps/frontend/knowledge test
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
```

Cross-package checks if exports or workspace dependencies change:

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

Docs:

```bash
pnpm check:docs
```

Minimum proof before implementation completion:

1. Core schema tests parse every page response model.
2. Backend tests prove each endpoint returns schema-safe projections.
3. Frontend API client tests prove canonical paths and schema parse.
4. Page tests prove provider-driven loading/error/empty states without runtime mock client.
5. Documentation scan confirms old mock-mode guidance is removed or marked historical.

## Documentation Impact

Update:

- `docs/contracts/api/knowledge.md`
- `docs/apps/frontend/knowledge/knowledge-frontend.md`
- `docs/apps/frontend/knowledge/knowledge-chat-lab.md` if chat payload wording changes
- `docs/apps/backend/agent-server/knowledge.md`
- `docs/packages/core/README.md` if new exports are added
- `docs/packages/knowledge/README.md` only if Agent Flow or RAG contract exports change

Scan and clean:

- `docs/apps/frontend/knowledge/**`
- `docs/contracts/api/knowledge.md`
- `docs/superpowers/specs/*knowledge*`
- `docs/superpowers/plans/*knowledge*`
- `AGENTS.md`

## Success Criteria

1. Running `apps/frontend/knowledge` without special env vars uses real `/api/knowledge/*` exclusively.
2. No runtime import path references `MockKnowledgeApiClient`, `mock-data`, or `VITE_KNOWLEDGE_API_MODE`.
3. Every Knowledge page has a documented endpoint and schema-backed response model.
4. Frontend business DTOs come from `@agent/core` or `@agent/knowledge`, not duplicated long-term local interfaces.
5. Backend endpoint responses pass schema parse before delivery or in tests.
6. Tests no longer depend on runtime mock client; they use local fake provider or fetch stubs.
7. Docs no longer instruct future work to build pages from frontend mock data.

## Design Decisions

1. `EvalRunStatus` includes `partial` in the canonical schema, because API docs already describe partial failure semantics.
2. Dashboard canonical endpoint is `/knowledge/dashboard/overview`, replacing the current client-only `/dashboard/overview` path under base `/api`.
3. Observability canonical endpoint is `/knowledge/observability/*` for namespace consistency; client helpers may hide the prefix but docs must not present conflicting paths.
4. Agent Flow contract remains owned by `@agent/knowledge`, with backend service/storage ownership in `apps/backend/agent-server`.
