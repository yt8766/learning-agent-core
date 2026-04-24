# Data Report Bundle Agent Redesign

状态：snapshot
文档类型：note
适用范围：`packages/core`、`agents/data-report`、`apps/backend/agent-server`、`/Users/dev/Desktop/gosh_admin_fe`
最后核对：2026-04-23

## 1. 背景

当前 `data-report-json` 链路已经同时承担这些职责：

- brand-new 报表 JSON 生成
- patch / change-request 修改
- 单报表与多报表规划
- SSE 进度事件推送
- 前端 `gosh_admin_fe` 的 schema 渲染与 patchOperations 展示适配

当前实现的主要问题：

- brand-new 生成链过长，首包耗时高
- 报表生成与报表编辑没有收敛到统一协议
- 单报表、页面内多报表、多个独立页面文档没有统一的顶层对象
- patch 能力已经存在，但还不是 canonical 编辑模型
- backend chat helper 仍承担较多 data-report 专项编排职责

用户目标已经明确收敛为：

- 首次生成改为单 Agent 直接生成完整 JSON
- 后续修改改为 Patch Agent 局部修改
- 同时支持单报表、页面内多报表、多个独立页面文档
- 支持图表、指标、table、section 的增删改
- 前端允许乐观预览，但以后端 apply patch 后返回的最终结果为准

## 2. 目标与非目标

### 2.1 目标

- 把 brand-new 生成链改为单 `Generate Agent`
- 把 change-request 编辑链改为单 `Patch Agent`
- 定义统一的 schema-first contract：
  - `ReportBundle`
  - `ReportDocument`
  - `ReportPatchOperation`
  - `GenerateReportBundleRequest`
  - `EditReportBundleRequest`
  - `ReportBundleResponse`
- 让单报表、页面内多报表、多个独立页面文档进入同一协议家族
- 让 backend 成为 patch 的唯一权威执行者
- 让 `/Users/dev/Desktop/gosh_admin_fe` 平滑兼容新协议

### 2.2 非目标

- 本轮不支持任意 JSON Path 风格的自由 patch
- 本轮不允许前端传入模型选择参数
- 本轮不要求一次性删除所有旧 data-report 渲染能力
- 本轮不要求立即重写 `gosh_admin_fe` 的全部渲染组件

## 3. 设计结论

本设计采用以下结论：

- `ReportBundle` 是 canonical 返回对象；即使只有一个页面，也统一返回 bundle
- `ReportDocument` 作为 bundle 内的页面级报表文档，兼容现有 `data-report-json` 主体语义
- “一个页面多个报表”继续使用单个 `ReportDocument.sections[]`
- “一个请求多个独立页面”通过 `ReportBundle.documents[]` 表达
- brand-new 生成改为单 `Generate Agent`，不再走现有多 LLM 节点 brand-new 主链
- 编辑改为 `Patch Agent -> ReportPatchOperation[] -> apply -> validate -> normalize`
- Patch Agent 只负责输出领域级 patch operations，不直接输出最终 bundle
- backend 是 patch 的唯一权威执行者；前端只允许做乐观预览

## 4. Canonical Contract

### 4.1 顶层对象

建议新增这组稳定 contract：

- `ReportBundle`
- `ReportDocument`
- `ReportPatchOperation`
- `GenerateReportBundleRequest`
- `EditReportBundleRequest`
- `ReportBundleResponse`

所有稳定 contract 默认采用 schema-first，主定义落在 `packages/core`。

### 4.2 `ReportBundle`

`ReportBundle` 表示一次生成或编辑请求的最终交付对象。

最小语义：

- `version: 'report-bundle.v1'`
- `kind: 'report-bundle'`
- `meta.bundleId`
- `meta.title`
- `meta.mode: 'single-document' | 'multi-document'`
- `documents: ReportDocument[]`
- `patchOperations?: ReportPatchOperation[]`
- `warnings?: string[]`

约束：

- 单文档场景仍返回 bundle；`documents.length === 1`
- 多独立页面场景使用多个 `documents`
- bundle 是 API、SSE、落库与前后端协作的 canonical 结果对象

### 4.3 `ReportDocument`

`ReportDocument` 表示一个页面级报表文档，保留现有 `data-report-json` 的主语义：

- `kind: 'data-report-json'`
- `meta.reportId`
- `meta.title`
- `meta.description`
- `meta.route`
- `meta.templateRef`
- `meta.scope: 'single' | 'multiple'`
- `filterSchema`
- `dataSources`
- `sections`
- `pageDefaults`
- `registries`
- `modification.strategy: 'patch-operations'`

约束：

- `sections[]` 继续承载“一个页面多个报表”
- 现有 `gosh_admin_fe` 的 `DataReportSchemaRenderer` 短期继续面向 `ReportDocument`
- 旧 `data-report-json` contract 可以保留 compat 出口，但 canonical 语义上升级为 `ReportDocument`

### 4.4 `ReportPatchOperation`

Patch 不采用任意 JSON Patch，而采用报表领域操作。

首批操作族至少覆盖：

- document/meta：
  - `replace-document-title`
  - `replace-document-description`
- section：
  - `add-section`
  - `remove-section`
  - `rename-section`
- block：
  - `add-block`
  - `remove-block`
  - `rename-block`
  - `update-chart-block`
- metric：
  - `add-metric-item`
  - `remove-metric-item`
  - `update-metric-item`
- table：
  - `rename-table`
  - `add-table-column`
  - `remove-table-column`
- filter：
  - `update-filter-default`

约束：

- 每个 operation 必须带稳定业务定位字段，例如 `documentId`、`sectionId`、`blockId`
- 每个 operation 必须带 `summary`
- `value` 只携带本次操作必要数据
- 不允许使用模糊 path 推断业务目标

### 4.5 请求对象

#### `GenerateReportBundleRequest`

用于从零生成 bundle：

- `input.messages: ReportAgentMessage[]`
- `input.structuredSeed?: ReportSeedInput`
- `context.projectId?: string`

约束：

- `messages` 必填
- `structuredSeed` 用于模板衍生、迁移、半结构化种子输入
- 前端不再传模型选择参数

#### `EditReportBundleRequest`

用于基于现有 bundle 继续编辑：

- `input.messages?: ReportAgentMessage[]`
- `input.requestedOperations?: ReportPatchOperation[]`
- `currentBundle: ReportBundle`
- `context.projectId?: string`

约束：

- `messages` 与 `requestedOperations` 至少提供一个
- `currentBundle` 必填
- 纯聊天编辑传 `messages + currentBundle`
- 可视化编辑传 `requestedOperations + currentBundle`
- 混合编辑允许两者并存，显式 `requestedOperations` 优先

### 4.6 响应对象

`ReportBundleResponse` 至少包含：

- `status: 'success' | 'partial' | 'failed'`
- `bundle?: ReportBundle`
- `patchOperations?: ReportPatchOperation[]`
- `runtime.executionPath: 'single-agent-generate' | 'patch-agent-edit'`
- `error`

约束：

- `generate` 返回完整 `bundle`
- `edit` 返回完整 `bundle`，并可附带 `patchOperations`
- 前端始终以最终 `bundle` 作为渲染基准

## 5. 执行架构

### 5.1 Generate Agent

brand-new 生成改为单 Agent 主导，执行形态固定为：

1. 接收 `messages + structuredSeed`
2. 直接生成完整 `ReportBundle`
3. 后端执行 schema validate
4. 后端执行 normalize
5. 返回最终 `ReportBundle`

原则：

- 不再沿用当前大量 LLM 子节点 brand-new 生成路径
- 单报表、页面内多报表、多个独立页面 bundle 均由同一 Generate Agent 处理
- 如果需要 deterministic 补全，放在 normalize/postprocess，而不是重新拆回多节点 LLM graph

### 5.2 Patch Agent

编辑改为单 Agent 产出领域级 patch：

1. 接收 `messages/requestedOperations + currentBundle`
2. 生成或补全 `ReportPatchOperation[]`
3. backend apply operations
4. backend validate
5. backend normalize
6. 返回最终 `ReportBundle`

原则：

- Patch Agent 不直接输出最终 bundle
- patch 结果必须由 backend 执行与兜底
- patch apply 出错时，应返回结构化错误而不是静默改坏 bundle

### 5.3 后端执行权威

Patch 的最终一致性固定由 backend 保证：

- 前端可以用 `patchOperations` 做乐观预览
- backend 返回的最终 `bundle` 覆盖任何本地乐观结果
- 不允许前端 patch 计算成为 canonical source

## 6. API 与 SSE

### 6.1 外部接口保持不变

本设计不新增新的外部报表 HTTP 路径，继续复用：

- `POST /api/chat`

并继续通过现有报表响应模式进入 data-report 协议链路，例如：

- `responseFormat=report-schema`

职责：

- backend controller 继续只负责 HTTP/SSE 适配
- 外部 transport 与前端调用方式保持不变
- 报表主逻辑改为由内部 report-bundle facade / agent host 承载
- chat service 不再直接承担报表专项主流程编排

### 6.2 内部执行重构

虽然外部接口仍是 `/api/chat`，但内部执行改为：

- `/api/chat` -> chat adapter -> report bundle facade
- facade 根据请求分流到 `Generate Agent` 或 `Patch Agent`
- facade 返回 canonical `ReportBundle`

兼容策略：

- 对单 document 场景，继续返回兼容 `schema` 数据，但它直接来自生成流程的 `primaryDocument`
- 但内部 canonical 结果对象已经切为 `ReportBundle`
- 自 `2026-04-24` 起，`/api/chat` report-schema 路径不再接受 legacy `CHANGE_REQUEST + CURRENT_SCHEMA` 文本输入；编辑必须显式传 `currentBundle`

### 6.3 SSE 语义

当前实现仍沿用 `schema_*` 事件名，但 payload 已按 bundle-first 收口：

- `schema_ready.data.bundle` 是 canonical 结果
- 最终 `done.data.bundle` 是前端应优先消费的 canonical 结果
- `schema` 仅在单 document 兼容场景下保留为兼容字段，且直接来自生成流程的 `primaryDocument`

## 7. 前端迁移策略

前端宿主：`/Users/dev/Desktop/gosh_admin_fe`

当前已具备的基础：

- `DataReportSchemaRenderer`
- `ReportCopilot`
- `patchOperations` 展示
- `currentSchema -> patch` 交互判断

迁移分两阶段：

### 7.1 当前边界

- 状态层必须以 `ReportBundle` 为 canonical 数据源
- 单 document 渲染可继续读取兼容 `schema`
- 多 document 场景必须显式提供 active document / switcher，而不是默认塌缩到 `documents[0]`
- `ReportCopilot` 继续展示 `patchOperations`

### 7.2 后续增强

- 新增 bundle-aware renderer 或 document switcher
- 支持多 document tabs / switcher
- 单页面多 sections 保持现有渲染习惯

## 8. 宿主落位

### 8.1 `packages/core`

新增稳定 contract 与 schema：

- `packages/core/src/contracts/data-report/report-bundle.ts`
- `packages/core/src/contracts/data-report/report-document.ts`
- `packages/core/src/contracts/data-report/report-patch-operation.ts`
- `packages/core/src/contracts/data-report/report-bundle-request.ts`
- `packages/core/src/contracts/data-report/report-bundle-response.ts`
- 对应 `schemas/` 与 `types/` 出口

### 8.2 `agents/data-report`

新增新的 graph / flow 宿主：

- `src/graphs/data-report/report-bundle-generate.graph.ts`
- `src/graphs/data-report/report-bundle-edit.graph.ts`
- `src/flows/report-bundle/`
  - `nodes/`
  - `prompts/`
  - `schemas/`
  - `runtime/`
  - `patch/`

### 8.3 `apps/backend/agent-server`

新增 facade，例如：

- `src/runtime/core/runtime-report-bundle-facade.ts`

控制器 / service 只负责：

- HTTP DTO 适配
- SSE 事件投递
- 兼容旧 `/api/chat` 入口

不再负责：

- data-report 主链编排
- patch apply 细节
- brand-new 多节点模型调度

## 9. 迁移步骤

### 第 1 步：Contract First

- 在 `packages/core` 落 schema-first contract
- 保留旧 `data-report-json` compat 出口
- 明确 `ReportBundle` 为 canonical return

### 第 2 步：Generate Agent

- 在 `agents/data-report` 新建单 Agent brand-new 生成链
- 确保单报表、单页面多报表、多文档 bundle 都可生成

### 第 3 步：Patch Agent

- 新建 patch 主链
- 落 `operations -> apply -> validate -> normalize`
- 覆盖图表、指标、table、section 的增删改

### 第 4 步：Backend Facade + API Compat

- 新增 generate/edit facade
- 旧 `/api/chat responseFormat=report-schema` 转发到新 facade

### 第 5 步：Frontend Migration

- `/Users/dev/Desktop/gosh_admin_fe` 先兼容单 document 投影
- 后续再升级到 bundle-aware

### 第 6 步：旧链路退场

在新链路稳定后，逐步退场：

- 旧 `data-report-json` brand-new 多节点生成链
- backend `chat-report-schema.helpers.ts` 中的专项编排
- 只服务旧分块生成语义的 stage / artifact 事件

外部 `/api/chat` 保持不变，不作为退场对象

## 10. 验收标准

本设计进入实施后，至少满足这些 DoD：

- brand-new 生成不再依赖当前多 LLM 节点主链
- 单报表生成成功
- 页面内多 section 生成成功
- 多 document bundle 生成成功
- 支持以下 patch：
  - 添加/删除图表
  - 添加/删除/修改指标
  - 修改 table 名称
  - 添加/删除列
  - 添加/删除/重命名 section
- `/Users/dev/Desktop/gosh_admin_fe` 的单 document 报表预览无功能回退
- 前端乐观预览不影响最终一致性；以后端返回 bundle 为准

## 11. 验证要求

后续实施至少补齐：

- Type
- Spec
- Unit
- Demo
- Integration

额外性能验证：

- 新旧 brand-new 生成耗时对比
- patch 操作正确率
- 单 document 兼容渲染回归
- 多 document bundle 渲染回归

## 12. 风险与回滚

主要风险：

- 新旧协议并存期间 canonical source 不清晰
- 前端仍以单 document 为主，bundle-aware 改造需要分阶段推进
- patch operation 范围若定义过宽，会重新退化成脆弱通用 patch

回滚策略：

- `/api/chat responseFormat=report-schema` 作为稳定外部入口持续保留
- 新 facade 出现 blocker 时，可临时回退旧执行流
- contract 先行，可让实现回滚而不破坏前端长期协议目标
