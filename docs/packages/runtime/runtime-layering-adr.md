# Runtime 分层 ADR

状态：current
文档类型：architecture
适用范围：`packages/runtime`、`packages/platform-runtime`、`apps/*`
最后核对：2026-04-19

## 背景

本仓库已经把多 Agent 主链逐步拆成：

- 契约层
- Runtime Kernel
- 官方组合根
- 专项 Agent
- 应用适配器

但在过去一段时间里，以下问题长期并存：

- `runtime` 与官方 agent 装配边界不够清楚
- `apps/backend`、`apps/worker` 容易残留“半装配”逻辑
- `platform-runtime` 一度像 helper 集合，而不是正式组合根
- app/service/query 层容易零散直连 `@agent/platform-runtime`
- 后续 AI 接手时，需要从多篇局部文档里拼出“到底谁是 kernel，谁是 composition root”

这份 ADR 用来把当前已经落地的分层决策正式定稿。

## 决策

固定采用以下分层模型：

```text
packages/core              = 稳定契约层
packages/runtime           = Runtime Kernel
packages/platform-runtime  = 官方组合根 / 官方装配层
agents/*                   = 专项 Agent 宿主
apps/*                     = 启动适配器
```

### 1. `packages/runtime` 是 Kernel

`packages/runtime` 负责：

- graph 执行
- session / checkpoint / recovery
- approval / interrupt / observability
- runtime lifecycle
- 面向抽象依赖的主链 orchestration

`packages/runtime` 不负责：

- 默认官方 agent 装配
- 对具体 `@agent/agents-*` 的直接依赖
- backend / worker / controller / UI 适配逻辑

实现约束：

- runtime 只依赖抽象 contract、registry、bridge/facade 注入点
- runtime 不重新持有官方组合根知识

### 2. `packages/platform-runtime` 是官方装配层

`packages/platform-runtime` 负责：

- 官方 agent registry
- 官方 `RuntimeAgentDependencies`
- 默认 `PlatformRuntimeFacade`
- backend / worker 共享的默认 runtime 创建线
- 官方 workflow / subgraph / version metadata facade

`packages/platform-runtime` 允许：

- 依赖官方 `agents/*`
- 持有 capability / descriptor / official module lookup
- 作为官方 composition root 暴露默认装配能力

`packages/platform-runtime` 不负责：

- controller
- worker loop
- app view-model
- 专项 agent graph 主实现
- 业务 service/query 逻辑

### 3. `apps/*` 是启动适配器

`apps/*` 负责：

- 选择装配方案
- 暴露 HTTP / SSE / worker / UI 入口
- 做宿主特有的 facade、DTO 适配、错误映射、鉴权与生命周期控制

`apps/*` 不负责：

- 重拼官方 registry / runtime bootstrap
- 重新实现 runtime host
- 直接内联官方 workflow / dispatch / ministry 装配

当前 backend / worker 的落实方式：

- backend 默认通过 `RuntimeHost` 持有 `PlatformRuntimeFacade`
- worker 默认通过 `createWorkerRuntimeHost()` 持有 `PlatformRuntimeFacade`
- backend app 源码允许直连 `@agent/platform-runtime` 的位置只保留：
  - `runtime/core/runtime.host.ts`
  - `runtime/core/runtime-data-report-facade.ts`

## 当前已落地的治理规则

当前仓库已经用检查脚本和包边界约束固化了部分红线：

- `packages/runtime` 禁止直接依赖官方 `@agent/agents-*`
- `agents/supervisor` 禁止直接依赖 sibling specialist official agents
- `apps/*` 禁止直接依赖官方 `@agent/agents-*`
- `apps/*` 禁止直接 import `@agent/platform-runtime` 中的主链装配 helper
- backend 业务源码禁止绕过 `runtime/core` 直接 import `@agent/platform-runtime`

这意味着当前分层不再只是文档约定，而是已有自动化治理兜底。

## 后果

正向影响：

- `runtime` 的 kernel 身份更稳定，不会继续回退成“认识官方 agent 的万能层”
- `platform-runtime` 作为官方 composition root 的职责更明确
- backend / worker 更容易保持“适配器”而不是“第二宿主”
- supervisor capability 化、app 层瘦身、边界治理都能围绕同一套分层继续推进

代价：

- app 层新增能力时，需要先判断应落在 kernel、组合根、agent 宿主还是适配器，而不是就近写到 controller/service
- `platform-runtime` 的 facade 和 metadata contract 需要持续维护，不能再退回松散 helper 集

## 对后续改动的直接要求

新增或修改实现时，默认按以下顺序判断落点：

1. 这是稳定公共 contract 吗？
   - 是：优先 `packages/core`
2. 这是抽象 runtime kernel 能力吗？
   - 是：优先 `packages/runtime`
3. 这是官方默认装配/wiring 吗？
   - 是：优先 `packages/platform-runtime`
4. 这是某个专项 agent 自己的 graph / flow / prompt / schema 吗？
   - 是：优先对应 `agents/*`
5. 这是宿主特有的启动/HTTP/SSE/worker/UI 适配吗？
   - 是：留在 `apps/*`

如果某段逻辑主要表现为：

- 读取 context / snapshot / records
- 产出派生结果、过滤结果、normalized view 或新 snapshot

则在 backend runtime 中应优先评估继续下沉到 `apps/backend/agent-server/src/runtime/domain/*`，而不是重新堆回 `centers/*` 或 `services/*`。
