# Platform Runtime 组合根 ADR

状态：current
文档类型：note
适用范围：`packages/platform-runtime`、`packages/runtime`、`apps/backend/*`
最后核对：2026-04-28

## 背景

仓库已经把 `packages/runtime` 收敛成 Runtime Kernel，但一段时间内官方默认装配仍分散在：

- `apps/backend/*` 的 runtime host / controller 适配层
- `apps/backend/agent-server` 的内建 background runner 启动线
- `apps/backend/agent-server/src/runtime/agents/*` 的官方 registry / helper

这会带来几个问题：

- app 层容易继续直接 import 官方主链 helper，形成“半装配”
- supervisor capability dispatch 难以稳定地依赖 descriptor / capability contract，而会回退到固定 `official.*` id
- 后台消费链路容易逐步演化成第二套 runtime host

## 决策

采用以下固定边界：

- `packages/runtime` 是 Runtime Kernel
  - 负责 graph、session、checkpoint、interrupt/recovery、runtime lifecycle
  - 不认识任何具体官方 agent
- `packages/platform-runtime` 是可注入 platform facade 包
  - 负责通用 agent registry 实现
  - 负责通用 workflow registry / execution contract
  - 负责默认 `PlatformRuntimeFacade`
  - 负责默认只读 metadata facade（workflow preset / subgraph descriptor / workflow version）
  - centers 只消费真实宿主 contract：治理策略与 connector health 来自 `@agent/runtime`，memory / rule / resolution / evidence 来自 `@agent/memory`
  - 从 runtime state snapshot 读取 loose governance 片段时，必须在本包投影层显式 guard / normalize，不能把 `unknown` 直接透传到 view-model 字段
  - 不允许依赖官方 `agents/*`
  - 不承载 controller、worker loop、view-model 或 graph 主实现
- `apps/*` 是启动适配器
  - backend 是官方 agent 组合根，负责把 `@agent/agents-*` 注册为 runtime dependencies
  - `apps/backend/agent-server` 是当前唯一官方后台消费入口；它通过 runtime bootstrap 启动内建 background runner，负责 queued task、learning job、lease reclaim、heartbeat 与 failure cleanup
  - 其他 app 只消费 backend 或自身显式注入的 facade
  - 旧后台 worker 应用已退役，不再作为 workspace package、部署进程、验证入口或文档入口存在。不要新增旧 worker 包名依赖，也不要恢复旧 worker 应用目录

## 当前执行约束

- `PlatformRuntimeFacade` 显式暴露：
  - `runtime`
  - `agentRegistry`
  - `agentDependencies`
  - `metadata`
- backend `createOfficialRuntimeAgentDependencies()` 默认优先按 capability contract 解析官方模块，再回退兼容 `official.*` id
- backend 官方 agent 组合根固定在 `apps/backend/agent-server/src/runtime/agents/`，这是 app 层唯一允许直接注册 `@agent/agents-*` 的位置；其他 app 代码必须继续通过 runtime/core facade 或 platform facade 获取能力
- backend 官方 workflow executor 当前固定经由 `apps/backend/agent-server/src/runtime/core/runtime-workflow-execution-facade.ts` 注入 `createPlatformWorkflowRegistry()`；`packages/platform-runtime` 只持有 workflow contract，不直接依赖或执行官方 `@agent/agents-*` graph
- `pnpm check:package-boundaries` 阻止 `apps/*` 直接 import `@agent/platform-runtime` 中的主链装配 helper，例如：
  - `resolveWorkflowPreset`
  - `listWorkflowPresets`
  - `listSubgraphDescriptors`
  - `listWorkflowVersions`
  - `resolveWorkflowRoute`
  - `runDispatchStage`
  - `createOfficialRuntimeAgentDependencies`
  - `createOfficialAgentRegistry`

## 后果

正向影响：

- supervisor capability 化可以依赖稳定 descriptor / capability contract 继续推进
- backend 更容易保持“适配器”而不是“第二宿主”
- runtime kernel 与官方组合根职责更清楚
- backend runtime 可以继续把纯规则下沉到 `runtime/domain/*`，而宿主层通过 facade / host / domain helper 组合能力，不必继续在 app/service 里回填官方装配细节

代价：

- app 层读取官方默认装配信息时，需要先经过 facade / RuntimeHost / 专门适配器
- `platform-runtime` 的 facade contract 需要持续维护，不能再退回“只导出几个 helper”或重新直接依赖 `@agent/agents-*`

## 后续执行

- 继续把 backend 中残留的官方 helper 读取面迁回 facade 或 backend agents 组合根
- 继续把更多只读 query / governance 读取面沉到 facade 或 host adapter，减少 app 侧直接 import 包根 helper 的需求
- 继续把 backend runtime 中的纯投影/纯状态规则沉到 `runtime/domain/*`，让 backend service/query 保持 thin orchestrator
- 继续把 `supervisor -> official specialist` 收敛为 capability / descriptor 驱动
