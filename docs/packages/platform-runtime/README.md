# platform-runtime 文档目录

状态：current
文档类型：index
适用范围：`packages/platform-runtime`
最后核对：2026-04-20

`packages/platform-runtime` 是官方平台装配层，也就是当前仓库的官方组合根。

本目录主文档：

- 本文是 `packages/platform-runtime` 的总体入口

本文只覆盖：

- platform runtime 职责边界
- 当前落地入口
- 与 runtime / agents / apps 的依赖关系

它的职责是把 runtime kernel、官方 agents、settings、provider、tool、memory、skill registry 这些能力组合成 backend / worker 可以复用的默认生产装配线。

当前已落地能力：

- 包根入口：`@agent/platform-runtime`
- 可注入 registry contract：
  - `AgentRegistry`（通用定义宿主：`@agent/agent-kit`）
  - `AgentProvider`（通用定义宿主：`@agent/agent-kit`）
  - `PlatformRuntimeFacade`
  - `PlatformAgentDescriptor` / `AgentDescriptor`（通用定义宿主：`@agent/agent-kit`）
- 默认装配入口：
  - `createPlatformRuntime({ runtime, agentRegistry, agentDependencies, metadata? })`
  - `createDefaultPlatformRuntimeOptions({ workspaceRoot?, settingsOptions?, ... })`
  - `createDefaultPlatformRuntime(options)`
- 官方 runtime dependency wiring：
  - `createOfficialRuntimeAgentDependencies({ agentRegistry? })`
- 官方 agent 注册表：
  - `createOfficialAgentRegistry()`
  - 默认注册 `official.supervisor` / `official.coder` / `official.reviewer` / `official.data-report`
  - 支持 `findAgentById`、`findAgentsByCapability`、`findAgentsByDomain`
  - 会把 specialist domain enrich 成官方 agent 线索（`agentId` / `candidateAgentIds`）
- 官方 Agent / workflow 出口：
  - supervisor workflow / subgraph / bootstrap skill helpers
  - coder / reviewer ministry exports
  - data-report runtime facade exports
  - 包根入口只暴露“官方装配 API”，不再对 `@agent/agents-*` 做透明 `export *` 透传

允许：

- 官方 Agent 注册与默认装配
- backend / worker 共享 runtime 启动线
- platform runtime facade 与 adapter
- 为测试、私有部署、未来第三方 Agent 保留可注入 registry

禁止：

- HTTP controller
- worker 消费循环
- 前端 view model
- Agent prompt、graph node、flow 主实现
- report blueprint/scaffold/write 主流程
- 业务策略判断或为了页面方便的展示聚合

当前实现：

- `platform-runtime` 负责把官方 `@agent/agents-*` 组装成 `RuntimeAgentDependencies`，再交给 `AgentRuntime`。
- 通用 `AgentDescriptor` / `AgentProvider` / `AgentRegistry` contract 已下沉到 `packages/agent-kit`；`platform-runtime` 只保留官方 registry 实现、默认装配与兼容 re-export。
- `createOfficialAgentRegistry()` 不再返回空表，而是持有默认官方 agent descriptor、capability 与 specialist domain 映射。
- `createDefaultPlatformRuntime()` 现在会把同一份官方 registry 同时注入 facade 与 runtime dependency wiring，避免默认装配出现“runtime 已创建但 registry 为空”的空心状态。
- `createDefaultPlatformRuntimeOptions()` 现在承载 platform profile、`process.cwd()` workspace root 与默认 runtime llm provider 的标准装配语义；backend / worker 如果只需要官方默认 runtime，再叠加各自 override，应优先复用这条入口，而不是在 app 层重复拼 `createDefaultRuntimeLlmProvider(...)`
- `PlatformRuntimeFacade` 当前显式暴露 `runtime + agentRegistry + agentDependencies + metadata`，其中 `metadata` 统一承接 workflow preset、subgraph descriptor、workflow version 等官方只读组合根信息；app 层如果需要读取这些能力，应优先从 facade / host 取值，而不是继续直接 import 主链 helper。
- `createOfficialRuntimeAgentDependencies()` 现在会在 `resolveSpecialistRoute()` 结果上追加 registry enrich，使 runtime 主链拿到的是“领域判断 + 官方候选 agent 线索”，而不是只有抽象 specialist domain。
- specialist enrich 现在会优先使用 `requiredCapabilities -> registry.findAgentsByCapability()` 命中官方 agent，再回退到 `findAgentsByDomain()`，开始把 supervisor specialist route 往 capability-driven dispatch 推进。
- `createOfficialRuntimeAgentDependencies()` 当前还会优先按 capability contract 解析 supervisor / coder / reviewer / data-report 官方模块，再回退固定 `official.*` id，避免组合根继续把 capability dispatch 写死成单一 agent id 约定。
- runtime task factory 的默认 counselor 选择也会优先消费这些官方 candidate agent ids，而不是只把 specialist domain 当成 counselor id。
- supervisor planning stage 生成的 `dispatches` 现在也会继续带上 `specialistDomain`、`requiredCapabilities`、`agentId`、`candidateAgentIds` 与 `selectedAgentId`，这样 checkpoint / projection / recovery 链路既能看到偏好候选，也能看到本次 dispatch 实际收敛到哪个官方 agent。
- supervisor / runtime 现在还会把上述能力态进一步沉淀为 `plannerStrategy` contract（`default` / `capability-gap` / `rich-candidates`），让 runtime center 与 admin workbench 直接观察当前规划为什么这样收敛。
- `packages/runtime/src/bridges/*` 仍保留为 runtime 内部兼容壳，但已经只读取 runtime contract，不再直接 re-export 官方 Agent。
- `@agent/platform-runtime` 包根入口现在只显式导出 backend / worker / runtime 真正消费的官方装配能力；raw agent class、prompt、graph 根入口仍留在各自 `@agent/agents-*` 包内，避免 platform runtime 演化成新的“大一统出口”。
- `platform-runtime` 可以依赖 `@agent/runtime` 与官方 `@agent/agents-*`，但 `packages/runtime` 不能反向依赖 `@agent/platform-runtime`。
- `pnpm check:package-boundaries` 现已阻止 `apps/*` 直接从 `@agent/platform-runtime` import `resolveWorkflowPreset`、`runDispatchStage`、`createOfficialRuntimeAgentDependencies`、`listWorkflowPresets`、`listSubgraphDescriptors`、`listWorkflowVersions` 这类主链装配 helper；应用层应通过 facade、RuntimeHost 或专门适配器读取这些能力。

验证入口：

```bash
pnpm exec tsc -p packages/platform-runtime/tsconfig.json --noEmit
pnpm --dir . exec vitest run --config vitest.config.js packages/platform-runtime/test
pnpm check:package-boundaries
```
