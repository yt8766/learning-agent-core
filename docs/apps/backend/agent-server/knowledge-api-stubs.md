# agent-server Knowledge API Stubs

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/knowledge`
对应接口规范：`docs/contracts/api/knowledge.md`
最后核对：2026-05-01

## 目标

Knowledge API stubs 用于 Knowledge 前端横向 MVP。`POST /chat` 已接入 repository-backed deterministic RAG 主链，观测接口已接入 repository trace projection，评测接口已接入 repository-backed dataset / run / result MVP；其余接口仍主要返回固定 fixture，覆盖总览、知识库和文档的基本数据面，让前端可以先打通端到端流程。

这些接口不是生产级完整实现；当前仍不负责真实上传、解析、embedding、向量检索或第三方 LLM 生成。`POST /chat` 的横向 MVP 会真实执行“检索上下文 -> deterministic 生成 -> 保存消息/trace”，但默认 retriever/generator 只是可替换 provider 边界，不是最终生产 RAG。`POST /eval/runs` 当前同步执行评测，默认 runner/judge 也是 deterministic 可替换边界，不透传第三方 LLM 类型。

## 当前入口

```text
apps/backend/agent-server/src/knowledge/
  knowledge.controller.ts
  knowledge.service.ts
  knowledge-eval.service.ts
  knowledge-rag.service.ts
  knowledge-observability.service.ts
  interfaces/knowledge-eval.types.ts
  interfaces/knowledge-rag.types.ts
  interfaces/knowledge-observability.types.ts
  knowledge-api-fixtures.ts
  repositories/knowledge.repository.ts
  repositories/knowledge-memory.repository.ts
```

测试入口：

```text
apps/backend/agent-server/test/knowledge/knowledge-stub-api.spec.ts
apps/backend/agent-server/test/knowledge/knowledge-eval.spec.ts
apps/backend/agent-server/test/knowledge/knowledge-rag.spec.ts
apps/backend/agent-server/test/knowledge/knowledge-observability.spec.ts
apps/backend/agent-server/test/knowledge/knowledge-repository.spec.ts
apps/backend/agent-server/test/knowledge/knowledge.service.spec.ts
```

## 当前覆盖

`KnowledgeController` 当前在 `knowledge/v1` 下暴露这些 stub 路由：

- `GET /dashboard/overview`
- `GET /knowledge-bases`
- `POST /knowledge-bases`
- `GET /knowledge-bases/:id`
- `GET /documents`
- `GET /documents/:id`
- `GET /documents/:id/jobs`
- `GET /documents/:id/chunks`
- `POST /chat`
- `POST /messages/:id/feedback`
- `GET /observability/metrics`
- `GET /observability/traces`
- `GET /observability/traces/:id`
- `GET /eval/datasets`
- `POST /eval/datasets`
- `GET /evals/datasets`
- `POST /evals/datasets`
- `GET /eval/runs`
- `POST /eval/runs`
- `POST /eval/runs/compare`
- `GET /eval/runs/:id`
- `GET /eval/runs/:id/results`
- `GET /evals/runs`
- `POST /evals/runs`
- `POST /evals/runs/compare`
- `GET /evals/runs/:id`
- `GET /evals/runs/:id/results`

全局 API prefix 由后端宿主统一处理，因此对外路径为 `/api/knowledge/v1/...`。

## Chat RAG 横向主链

`KnowledgeService.chat(input)` 现在是 async：

- 如果注入了 `KnowledgeRagService`，会先把公开 HTTP body 中的 `tenantId` / `createdBy` 覆盖为服务端 MVP 上下文，再委托 `answer(input)`。
- 如果只有 repository，则同样先覆盖服务端上下文，再临时创建 deterministic `KnowledgeRagService`，用于旧测试和横向 MVP。
- 如果没有 repository / rag service，才保留原 fixture fallback。

公开 `POST /chat` body 为了兼容前端仍可携带历史字段，但服务端不会信任 body 中的租户或创建人。当前 MVP 统一使用 `ws_1` 和 `user_demo` 作为服务端上下文；`KnowledgeRagService.answer()` 仍支持内部调用方显式传入 `tenantId` / `createdBy`。RAG 输入支持 `conversationId`、`message`、`knowledgeBaseId`，并兼容 contract 中的 `knowledgeBaseIds`。空 `message` 会抛出稳定 BadRequest，不写 chat message。

默认 retriever 通过 repository `listChunks({ tenantId, knowledgeBaseId })` 读取 chunks，再用小写分词与 chunk 文本重叠度 deterministic 排序，`topK` 默认 5。返回 citation 前会做稳定 projection：保留 `chunkId`、`documentId`、`text`、`quote`、`title`、`score`、`rank` 等前端字段，`text` / `quote` / `contentPreview` 分别截断到 240 / 160 / 120 字符，metadata 仅保留 `title`、`sourceUri`、`tags`，不透传 raw / vendor / embedding / secret / token / password 等字段。默认 generator 有命中时引用最相关 chunk 的投影内容，无命中时返回固定话术“未在当前知识库中找到足够依据。”。

成功回答会先写 user message，再写入 `operation: "rag.chat"`、`status: "succeeded"` 的 trace，随后写 assistant message；assistant message 保存已投影 citations，并只在 trace 成功持久化后于 metadata 中记录 traceId，避免指向不存在的 trace。trace metadata 仅保存 question / answer preview、createdBy 与 citation summaries，不保存完整原始 answer、citation 或 chunk payload。流程中失败时会尽量写入 `status: "failed"` trace；如果 failed trace 写入也失败，仍重新抛出原始 retriever / generator / persist 错误。

## Observability 横向主链

`KnowledgeService.getObservabilityMetrics()`、`listTraces()`、`getTrace(id)` 现在优先委托 `KnowledgeObservabilityService`。如果注入了 observability service 会直接使用；如果只有 repository，则临时创建 observability service；如果 repository 和 observability service 都不存在，才保留旧 fixture fallback，便于旧测试和未装配路径继续运行。

`KnowledgeObservabilityService` 的边界是 API DTO projection，不向 controller 返回 repository raw record。它只读取 trace 的稳定字段和 Task 7 写入的 metadata projection：

- `questionPreview`
- `answerPreview`
- `createdBy`
- `citationSummaries`

`GET /observability/metrics` 基于 repository traces 计算 `traceCount`、`questionCount`、平均延迟、p95、p99、`errorRate`、`timeoutRate`、`noAnswerRate`、`citationClickRate` 和 `stageLatency`。p95 / p99 使用 nearest-rank：对升序样本取 `ceil(percentile * n) - 1`，小样本也稳定可复现。无 trace 时返回全 0 指标与空 `stageLatency`。

`GET /observability/traces` 基于 `tenantId` 与可选 `knowledgeBaseId` 从 repository 查询 trace，返回 list DTO：`id`、`workspaceId`、`conversationId`、`messageId`、`knowledgeBaseIds`、`question`、`answer`、`status`、`latencyMs`、`hitCount`、`citationCount`、`createdBy`、`createdAt`。

`GET /observability/traces/:id` 通过 repository `getTrace({ tenantId, id })` 查询 detail。找不到 trace 时抛 `NotFoundException`。detail 的 `spans` 从 trace spans 的 `stage` / `name` / `latencyMs` / `status` 等稳定字段投影，`citations` 与 `retrievalSnapshot.selectedChunks` 从 `citationSummaries` 生成；不会返回 raw metadata、vendor response、完整 chunk payload 或第三方对象。

## Eval 横向主链

`KnowledgeService.listEvalDatasets()`、`listEvalRuns()`、`getEvalRun(id)`、`listEvalRunResults(id)`、`createEvalDataset(input)`、`createEvalRun(input)`、`compareEvalRuns(input)` 现在优先委托 `KnowledgeEvalService`。如果注入了 eval service 会直接使用；如果只有 repository，则临时创建 eval service；如果 repository 和 eval service 都不存在，才保留旧 fixture fallback，便于未装配路径继续运行。

公开 eval API 不信任 HTTP body 中的 `tenantId` / `createdBy`。当前 MVP 统一使用 `ws_1` 与 `user_demo` 作为服务端上下文；`KnowledgeEvalService` 内部调用仍支持显式 tenant / creator，用于测试、任务编排和后续多租户宿主接线。

评测 dataset 已从 fixture 切到 repository record，包含 `id`、`tenantId`、`name`、`tags`、`cases`、`createdBy`、`createdAt`、`updatedAt`。case 当前内嵌在 dataset record 中，包含 `id`、`question`、`expectedChunkIds`、`referenceAnswer` 和可选 `metadata`。repository 同时持久化 run 与 result：run 支持 `queued`、`running`、`succeeded`、`failed`、`canceled` 状态；MVP 的 `runDataset` 同步执行，并最终写入 `succeeded` 或 `failed`。

`KnowledgeEvalRunner.answerCase()` 是可替换 answer 边界，默认通过 deterministic RAG 主链回答 case，不穿透第三方 LLM、向量库或 SDK 类型。`KnowledgeEvalJudge.judge()` 是可替换 judge 边界，默认 deterministic judge 只基于 reference answer、retrieved chunk ids 和 citations 计算 `faithfulness`、`answerRelevance`、`citationAccuracy`，不会调用 LLM。

每个 case result 会写入 `actualAnswer`、`retrievedChunkIds`、`citations`、`retrievalMetrics`、`generationMetrics`、可选 `traceId` 与错误信息。retrieval metrics 包含 `recallAtK`、`precisionAtK`、`mrr`、`ndcg`，所有空 expected / retrieved 场景都稳定返回 `0`，不会产生 `NaN`。run summary 聚合 `caseCount`、`completedCaseCount`、`failedCaseCount`、`retrievalScore`、`generationScore`、`totalScore`，当前分数语义为 `0-1` 小数区间。

`compareEvalRuns()` 读取 baseline / candidate run summary 与 result metrics，返回 `totalScoreDelta`、`retrievalScoreDelta`、`generationScoreDelta` 和 `perMetricDelta`。delta 使用 candidate 减 baseline，保留 `0-1` 小数语义。

## 替换边界

后续纵向生产化时保持 controller 路径和 API contract 不变，逐步替换 service 内部：

- dashboard 来源改为真实统计聚合。
- knowledge base / document 来源改为 repository。
- chat 从 deterministic retriever/generator 替换为真实 RAG runtime + host generation；第三方 LLM / 向量库只能进入 provider/adapter，不能穿透 controller/service 业务层。
- observability 已接入 repository trace store 与 metrics projection；后续纵向生产化需要补齐持久化 trace store、真实点击/反馈指标、分页与时间范围过滤。
- eval 已接入 dataset / case / run / result repository MVP；后续纵向生产化需要补异步队列、取消/恢复、真实 judge provider、分页过滤和持久化 store。
- fixture 文件在真实 repository 接线后只能作为测试 fixture，不再作为 service 数据源。
