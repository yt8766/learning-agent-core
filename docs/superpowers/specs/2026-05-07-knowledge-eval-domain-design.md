# Knowledge Eval Domain Design

状态：draft
文档类型：spec
适用范围：`packages/knowledge/src/evals`、`apps/backend/agent-server/src/domains/knowledge`、`apps/backend/agent-server/src/api/knowledge`、`apps/frontend/knowledge`、`docs/contracts/api/knowledge.md`
最后核对：2026-05-07

## 背景

当前知识库评测能力存在两套入口：

- 历史 `apps/backend/agent-server/src/knowledge` 已经有较完整的 repository-backed eval MVP，覆盖 dataset、case、run、result、retrieval metrics、deterministic judge 与 run comparison。
- 统一 `apps/backend/agent-server/src/domains/knowledge` 已成为新的 frontend-facing Knowledge domain，但其中 `KnowledgeEvalService` 仍是占位 answerer，canonical `KnowledgeApiController` 也尚未暴露 `/eval/*` endpoint。

前端 `apps/frontend/knowledge` 已有 Evals 页面和 React Query hook，可展示 datasets、runs 与 run comparison；契约文档 `docs/contracts/api/knowledge.md` 已记录 eval DTO 与 endpoint，但 status、score 区间和真实后端接线仍需要统一。

本设计目标是把知识库评测从“历史路径可跑 + 新路径占位”收敛为 `packages/knowledge` 承载核心能力、统一 Knowledge Domain 负责后端接线的正式能力。

## 目标

1. `packages/knowledge/src/evals` 成为知识库/RAG 专属评测核心宿主。
2. 统一 Knowledge Domain 成为知识库评测的 canonical 后端接线宿主。
3. `docs/contracts/api/knowledge.md` 成为 eval DTO、status、score 区间、错误语义和兼容策略的唯一先行契约。
4. 后端支持创建 dataset、运行 eval、读取 case results、比较 baseline/candidate run。
5. 默认 eval runner 使用统一 domain 的 RAG service，默认 judge 使用 `@agent/knowledge/evals` 的 deterministic judge；后续可替换为 LLM-as-Judge 或人工评审。
6. 前端 Evals 页升级为评测工作台，展示指标、失败分类、case 结果和 trace 跳转。
7. 保留历史 `/evals/*` alias 兼容语义，但新增调用方使用 `/eval/*`。

## 非目标

- 本阶段不建设完整异步评测平台。
- 本阶段不把 LLM-as-Judge、人工打分和 A/B 测试全部做成生产功能。
- 本阶段不引入新的第三方评测框架作为业务层直接依赖。
- 本阶段不继续扩展历史 `apps/backend/agent-server/src/knowledge` 作为新业务主入口。
- 本阶段不把知识库/RAG 专属评测指标放入 `packages/evals`。`packages/evals` 继续承载通用 prompt regression、benchmark、quality gate 和 runtime/tool execution evaluator。

## 指标体系

评测指标分为五组，避免只堆通用文本相似度指标。

### Retrieval

- `recallAtK`：预期 chunk 被检索到的比例。
- `precisionAtK`：检索结果中命中预期 chunk 的比例。
- `mrr`：第一个相关结果的倒数排名。
- `ndcg`：排序质量。
- `hitAtK`：至少命中一个预期 chunk 时为 `1`，否则为 `0`。

### Context

- `contextRecall`：最终进入回答上下文的预期证据覆盖率。
- `contextPrecision`：最终上下文中有效证据占比。

### Citation

- `citationAccuracy`：引用是否指向真实且相关的证据。
- `citationRecall`：引用是否覆盖预期证据。
- `citationPrecision`：引用集合中有效引用占比。

### Generation

- `faithfulness`：回答是否能由证据支持。
- `answerRelevance`：回答是否切中问题。
- `completeness`：答案是否覆盖 reference answer 的关键点。
- `refusalAccuracy`：证据不足时是否正确拒答或要求补充信息。
- `hallucinationRisk`：回答中无证据支撑内容的风险评分。

`BLEU`、`ROUGE`、`BERTScore` 仅作为可选离线指标。它们不作为 RAG 问答主门禁，因为它们容易惩罚合理改写，也不能直接证明回答有证据支撑。

### End-to-End

- `totalScore`：综合分。
- `retrievalScore`：retrieval/context/citation 聚合分。
- `generationScore`：faithfulness/relevance/completeness/refusal 聚合分。
- `regressionDelta`：相对 baseline 的总分变化。
- `latencyMs`：case 执行耗时。
- `tokenCostEstimate`：可选成本估算。

内部 score 统一使用 `0-1` 小数。前端展示百分比时在展示层转换为 `0-100`，避免 API、fixture 和 UI 混用不同区间。

## 数据模型

### EvalDataset

Dataset 是可复用评测集，包含名称、标签、case 数量、创建人和 cases。Case 支持：

- `question`
- `referenceAnswer`
- `expectedDocumentIds`
- `expectedChunkIds`
- `tags`
- `difficulty`
- `sourceTraceId`
- `metadata`

Case 类型建议通过 `tags` 或 `metadata.caseType` 标注：

- `single-hop`
- `multi-hop`
- `no-answer`
- `permission-denied`
- `freshness`
- `citation-required`
- `robustness`

### EvalRun

Run 表示一次 dataset 执行。状态统一为：

- `queued`
- `running`
- `completed`
- `partial`
- `failed`
- `canceled`

单个 case 失败时不吞掉已成功结果。至少一个 case 成功且至少一个 case 失败时，run 为 `partial`；全部成功为 `completed`；全部失败为 `failed`。

### EvalCaseResult

Case result 记录：

- `status`
- `question`
- `actualAnswer`
- `retrievedChunkIds`
- `citations`
- `traceId`
- `retrievalMetrics`
- `contextMetrics`
- `citationMetrics`
- `generationMetrics`
- `judgeResult`
- `failureCategory`
- `latencyMs`
- `error`

失败分类沿用契约方向：

- `not_retrieved`
- `ranked_too_low`
- `context_truncated`
- `unsupported_citation`
- `hallucination`
- `irrelevant_answer`
- `prompt_failure`
- `provider_error`
- `permission_denied`
- `timeout`

## 架构与包边界

### Canonical 落点

知识库评测分为核心能力、后端接线、通用评测基建和前端产品面四层。

知识库/RAG 专属评测核心落在 `packages/knowledge/src/evals`：

```text
packages/knowledge/src/evals/
  contracts/
    knowledge-eval.contracts.ts
  schemas/
    knowledge-eval.schemas.ts
  metrics/
    retrieval-metrics.ts
    citation-metrics.ts
    generation-metrics.ts
    summary-metrics.ts
  judges/
    deterministic-knowledge-eval-judge.ts
  runtime/
    run-knowledge-eval-dataset.ts
  index.ts
```

`packages/knowledge/src/evals` 负责：

- `KnowledgeEvalDataset`、`KnowledgeEvalCase`、`KnowledgeEvalRun`、`KnowledgeEvalCaseResult` 等知识库评测 schema/type。
- retrieval、context、citation、generation 和 summary 指标计算。
- deterministic judge。
- `KnowledgeEvalRunner`、`KnowledgeEvalJudge`、`KnowledgeEvalResultSink` 等可注入接口。
- `runKnowledgeEvalDataset()` 这类不依赖 Nest、HTTP、repository 具体实现的纯 runtime。

统一后端接线落在 `apps/backend/agent-server/src/domains/knowledge`：

```text
apps/backend/agent-server/src/domains/knowledge/
  services/
    knowledge-eval.service.ts
  repositories/
    knowledge.repository.ts
    knowledge-memory.repository.ts
    knowledge-postgres.repository.ts
  domain/
    knowledge-eval.schemas.ts
    knowledge-eval.types.ts
```

统一 domain 只负责：

- auth、tenant、permission 和 API 错误映射。
- dataset/run/result 持久化。
- 把 `KnowledgeRagService` 适配成 `KnowledgeEvalRunner`。
- 调用 `@agent/knowledge/evals` 的 runtime、metrics 和 judge。
- 写入 trace link、run summary 和 repository record。

`apps/backend/agent-server/src/api/knowledge/knowledge.controller.ts` 负责暴露 canonical HTTP shell，不承载指标计算、runner、judge 或 repository 细节。

历史 `apps/backend/agent-server/src/knowledge/knowledge-eval.service.ts` 作为迁移参考。迁移完成后不再新增功能；如果仍需兼容旧入口，只保留 thin delegation 或明确标注过渡用途。

`packages/evals` 继续保留通用评测基建职责：

- prompt regression
- benchmark
- quality gate
- runtime/tool execution evaluator
- 通用 eval facade

`packages/evals` 不承载 Recall@K、NDCG、citation grounding、RAG dataset case、RAG trace link 等知识库专属模型。

### Service 边界

`KnowledgeEvalService` 负责：

- dataset 创建与列表。
- eval run 创建、执行与状态更新。
- case result 记录。
- summary 聚合。
- baseline/candidate comparison。

`KnowledgeEvalService` 不重复实现指标算法，而是调用 `@agent/knowledge/evals`。

`KnowledgeEvalRunner` 由 `packages/knowledge/src/evals` 定义接口，由 `agent-server` 提供默认实现。该默认实现将 case question 交给统一 domain `KnowledgeRagService`，并提取：

- answer
- citations
- retrieved chunks
- trace id
- latency

`KnowledgeEvalJudge` 由 `packages/knowledge/src/evals` 定义接口。默认 deterministic judge 使用 reference answer token overlap、citation overlap 和 refusal 规则。后续 LLM-as-Judge 作为新 provider 实现接入，不改变 service contract。

### Repository 边界

统一 domain repository contract 需要覆盖：

- `createEvalDataset`
- `listEvalDatasets`
- `getEvalDataset`
- `createEvalRun`
- `listEvalRuns`
- `getEvalRun`
- `updateEvalRun`
- `createEvalResult`
- `listEvalResults`

Postgres 写入 JSON 字段前统一序列化，并在 SQL 参数处显式 cast。第三方数据库对象不得穿透到 service 或 API DTO。

## API

Canonical endpoint：

```text
GET  /api/knowledge/eval/datasets
POST /api/knowledge/eval/datasets
POST /api/knowledge/eval/datasets/:id/cases
GET  /api/knowledge/eval/runs
POST /api/knowledge/eval/runs
GET  /api/knowledge/eval/runs/:id
GET  /api/knowledge/eval/runs/:id/results
POST /api/knowledge/eval/runs/compare
```

兼容 alias：

```text
/api/knowledge/evals/*
/api/knowledge/v1/eval/*
/api/knowledge/v1/evals/*
```

新增前端调用优先使用 `/eval/*`。Alias 只做兼容，不形成第二套业务实现。

公开 API 忽略 body 中的 `tenantId` 和 `createdBy`，以服务端认证上下文为准。测试和内部 service 可以保留显式 tenant 参数。

## 前端工作台

`apps/frontend/knowledge/src/pages/evals/evals-page.tsx` 从概览页升级为评测工作台：

- 顶部指标：dataset 数、case 数、run 数、最新总分、回归变化。
- Dataset 列表：名称、标签、case 数、最近运行状态。
- Run 表格：status、case 完成数、失败数、总分、retrieval/generation/citation 分。
- Run comparison：baseline/candidate 选择器、指标 delta、失败 case diff。
- Case results：问题、期望证据、实际引用、trace link、failure category。
- Empty state：没有 dataset 时引导从 trace 或聊天反馈创建 case。

前端仍通过 `useKnowledgeEvals()` 封装数据请求，内部使用 React Query query keys。页面不直接拼接 raw API response，不自行推导后端未声明字段。

## Observability 与反馈沉淀

每个 eval case result 尽量关联 `traceId`。Trace detail 展示 retrieval、context assembly、answer、citation 和 judge span。

Chat message 可通过 `/messages/:id/add-to-eval` 沉淀到 dataset。该能力需要保留权限门槛：`owner`、`admin`、`maintainer`、`evaluator` 可写，`viewer` 不可写。

线上反馈不自动进入 release gate dataset。默认进入候选池，由 evaluator 筛选后加入 regression dataset。

## 错误处理

- dataset 不存在：`eval_dataset_not_found`
- run 不存在：`eval_run_not_found`
- case 输入非法：`validation_error`
- RAG 执行失败：case result 记录 `provider_error` 或 `prompt_failure`
- 权限不足：`auth_forbidden`
- 超时：case result 记录 `timeout`，run 可继续执行后续 case

Eval run 必须能部分失败可交付。Controller 不应因单个 case 失败返回 500；只有无法创建 run、无法读取 dataset 或 repository 整体不可用时才返回请求级错误。

## 测试策略

### Backend Unit

`packages/knowledge`：

- eval schema parse / infer contract。
- run 全成功为 `completed`。
- run 部分失败为 `partial`。
- run 全失败为 `failed`。
- retrieval、context、citation、generation metrics 有限且不返回 `NaN`。
- deterministic judge 生成 faithfulness、answerRelevance、citationAccuracy。
- compareRuns 返回 total/retrieval/generation/perMetric delta。
- `runKnowledgeEvalDataset()` 通过注入 runner、judge 和 sink 完成纯 runtime 闭环。

`apps/backend/agent-server`：

- dataset 创建校验。
- service 正确调用 `@agent/knowledge/evals` runtime。
- RAG runner adapter 从 `KnowledgeRagService` 提取 answer、citations、retrieved chunks、trace id 和 latency。
- repository 写入 dataset/run/result，且不泄漏跨 tenant 数据。

### Backend Controller

- `/eval/datasets`
- `/eval/runs`
- `/eval/runs/:id/results`
- `/eval/runs/compare`
- `/evals/*` alias
- `tenantId` / `createdBy` body 字段被服务端上下文覆盖。

### Frontend

- hook 加载 datasets、runs 和 comparison。
- 页面展示空态、运行中、失败、partial 和 completed。
- comparison 选择最新两个 run 后可刷新。
- case result 展示 failure category、trace link 和指标。

### Docs / Contract

- `docs/contracts/api/knowledge.md` 与前后端类型保持一致。
- `docs/packages/knowledge/README.md` 或专题文档记录 `packages/knowledge/src/evals` 为知识库评测核心。
- `docs/packages/evals/README.md` 明确 `packages/evals` 不承载知识库/RAG 专属指标。
- `docs/apps/backend/agent-server/knowledge.md` 标注统一 domain 为 canonical eval 入口。
- 迁移后清理或降级历史 `src/knowledge` 文档描述，避免双主实现。

## 分期

### Phase 1：抽取知识库 eval 核心

- 新建 `packages/knowledge/src/evals`。
- 迁移或重写 metrics、schemas、contracts、deterministic judge、summary 和 compare runtime。
- 从 `@agent/knowledge/evals` 暴露知识库评测核心入口。
- 为 `packages/knowledge` 增加 eval contract 和 metrics 单测。

### Phase 2：统一契约与后端 domain

- 统一 status 和 score 区间。
- 让 `apps/backend/agent-server/src/domains/knowledge` 调用 `@agent/knowledge/evals`，而不是重复实现指标算法。
- 补齐 repository contract、memory/postgres 实现和 RAG runner adapter。
- canonical controller 暴露 `/eval/*`。
- 保留 alias 测试。

### Phase 3：前端工作台

- 增强 Evals 页面。
- 增加 case results、comparison diff 和 trace link。
- 修正百分比展示。

### Phase 4：生产增强

- LLM-as-Judge provider。
- 人工评审。
- A/B 测试。
- 异步队列。
- release gate 阈值。
- feedback 自动候选池。

Phase 4 不阻塞 Phase 1/2/3 的 MVP 完成。

## 成功标准

- `packages/knowledge/src/evals` 承载知识库/RAG 专属评测核心，`packages/evals` 不混入知识库指标。
- 新 Knowledge 前端可通过 `/api/knowledge/eval/*` 完成 dataset 创建、run 执行、result 查看和 comparison。
- 历史 `src/knowledge` 不再作为新增 eval 能力主入口。
- 指标至少覆盖 retrieval、citation、generation 和 end-to-end summary。
- run 支持 partial 状态并保留成功 case 结果。
- 前端能定位失败 case，并跳转关联 trace。
- 文档、`@agent/knowledge/evals`、domain service、controller、前端类型和测试保持一致。

## 自检记录

- 无 `TBD` / `TODO` 占位。
- Scope 聚焦在 Knowledge Eval Domain MVP，生产增强拆到 Phase 4。
- `packages/knowledge/src/evals`、agent-server domain、frontend 和 `packages/evals` 职责边界一致。
- Score 区间、status 语义和 alias 兼容策略已显式定义。
